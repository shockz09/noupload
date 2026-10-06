// Real-time preview for the video editor.
//
// Every media clip gets its own hidden <video>/<audio> element, kept in step with
// a wall-clock timeline: elements play while their clip is under the playhead and
// are re-seeked when they drift. Each frame goes through the same renderFrame()
// the exporter uses. Selection handles live in an overlay outside the canvas,
// so they stay reachable when a clip fills the frame.
//
// Once playback has started, element audio is routed through Web Audio so a
// clip's gain can go past 100% and follow the ducking envelope, as it will in
// the export.

import { duckAt, duckEnvelope } from "./audio";
import {
  audioFades,
  type Clip,
  type ClipEdges,
  clipEnd,
  createScratch,
  drawOrder,
  fadeGain,
  type Geometry,
  geometryCorners,
  hitGeometry,
  imageDrawable,
  type MediaClip,
  type MediaItem,
  mediaGeometry,
  type Project,
  poseAt,
  projectDuration,
  renderFrame,
  sourceTime,
  type TextClip,
  textGeometry,
  transitionMap,
  visualWindow,
} from "./model";

const MAX_PREVIEW_WIDTH = 1280;
const DRIFT = 0.3;
/** Screen pixels between the top edge and the rotate handle. */
export const ROTATE_HANDLE_GAP = 26;
/** Half-size of a corner handle, in screen pixels. */
export const HANDLE_HIT = 9;

export interface Guide {
  axis: "x" | "y";
  /** Frame coordinate in project pixels. */
  at: number;
}

interface Entry {
  el: HTMLMediaElement;
  mediaId: string;
  gain: GainNode | null;
}

export class PreviewEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: Project | null = null;
  private edges = new Map<string, ClipEdges>();
  private media = new Map<string, MediaItem>();
  private elements = new Map<string, Entry>();
  private images = new Map<string, HTMLImageElement>();
  private scratch = createScratch();
  private raf = 0;
  private dirty = true;
  private clockStart = 0;
  private clockOrigin = 0;
  private scale = 1;
  private audio: AudioContext | null = null;
  private duck: Float32Array | null = null;
  private duckKey = "";
  private duckTimer = 0;

  time = 0;
  playing = false;
  /** Playback rate of the timeline; negative plays backwards (J). */
  rate = 1;
  /** A text clip being edited in place is left out of the frame. */
  editingId: string | null = null;
  onTime: (t: number) => void = () => {};
  onPlayingChange: (playing: boolean) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.loop = this.loop.bind(this);
    this.onFonts = this.onFonts.bind(this);
    document.fonts?.addEventListener("loadingdone", this.onFonts);
  }

  private onFonts() {
    this.requestDraw();
  }

  setProject(project: Project, media: Map<string, MediaItem>) {
    const sizeChanged = !this.project || this.project.width !== project.width || this.project.height !== project.height;
    this.project = project;
    this.media = media;
    this.edges = transitionMap(project);
    if (sizeChanged) {
      this.scale = Math.min(1, MAX_PREVIEW_WIDTH / project.width);
      this.canvas.width = Math.round(project.width * this.scale);
      this.canvas.height = Math.round(project.height * this.scale);
    }
    for (const f of new Set(project.clips.filter((c): c is TextClip => c.type === "text").map((c) => c.font))) {
      // Kick off any web font a text clip uses; the loadingdone listener redraws.
      document.fonts?.load(`16px ${f === "serif" ? '"Instrument Serif"' : '"Onest"'}`).catch(() => {});
    }
    this.syncElements();
    this.scheduleDuck();
    this.requestDraw();
  }

  seek(t: number) {
    const dur = this.project ? projectDuration(this.project) : 0;
    this.time = Math.max(0, Math.min(t, Math.max(dur, 0)));
    if (this.playing) {
      this.clockOrigin = this.time;
      this.clockStart = performance.now();
      // Force a hard re-sync of every element to the new position.
      for (const { el } of this.elements.values()) el.pause();
    }
    this.onTime(this.time);
    this.requestDraw();
  }

  /** Start playback at `rate` (1 = normal, 2 = double, -1 = backwards). */
  play(rate = 1) {
    if (!this.project) return;
    const dur = projectDuration(this.project);
    if (dur <= 0) return;
    if (rate > 0 && this.time >= dur - 0.01) this.time = 0;
    if (rate < 0 && this.time <= 0.01) return;
    this.ensureAudio();
    this.rate = rate;
    this.playing = true;
    this.clockOrigin = this.time;
    this.clockStart = performance.now();
    for (const { el } of this.elements.values()) el.pause();
    this.onPlayingChange(true);
    this.requestDraw();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.rate = 1;
    for (const { el } of this.elements.values()) el.pause();
    this.onPlayingChange(false);
    this.requestDraw();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.duckTimer);
    this.raf = 0;
    document.fonts?.removeEventListener("loadingdone", this.onFonts);
    for (const { el } of this.elements.values()) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    this.elements.clear();
    this.audio?.close().catch(() => {});
    this.audio = null;
  }

  requestDraw() {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  /** Project pixels per screen pixel, for sizing handles and hit areas. */
  unit() {
    const w = this.canvas.clientWidth || this.canvas.width;
    return (this.project?.width ?? this.canvas.width) / w;
  }

  /** Where a visual clip sits on the frame at the current time, or null if it has nothing to show. */
  geometry(clip: Clip, t = this.time): Geometry | null {
    if (!this.project) return null;
    const { width: W, height: H } = this.project;
    const pose = poseAt(clip, Math.min(Math.max(t - clip.start, 0), clip.duration));
    if (clip.type === "text") return textGeometry(this.ctx, clip, pose, W, H);
    const item = this.media.get(clip.mediaId);
    if (!item || item.kind === "audio" || !item.width) return null;
    const track = this.project.tracks.find((tr) => tr.id === clip.trackId);
    if (track?.kind === "audio") return null;
    return mediaGeometry(clip, pose, item.width, item.height, W, H);
  }

  /** Whether a clip is drawn at the current time. */
  onScreen(clip: Clip) {
    const [from, to] = visualWindow(clip, this.edges.get(clip.id));
    return this.time >= from && this.time < to;
  }

  /** Top-most visible clip under a frame-space point at the current time. */
  hitTest(x: number, y: number): string | null {
    if (!this.project) return null;
    const tracks = drawOrder(this.project).reverse();
    for (const track of tracks) {
      const clips = this.project.clips.filter((c) => c.trackId === track.id).sort((a, b) => b.start - a.start);
      for (const clip of clips) {
        if (!this.onScreen(clip)) continue;
        const g = this.geometry(clip);
        if (g && hitGeometry(g, x, y)) return clip.id;
      }
    }
    return null;
  }

  /** Render the current frame at full project size, without any selection chrome. */
  snapshot(): HTMLCanvasElement | null {
    const p = this.project;
    if (!p) return null;
    const canvas = document.createElement("canvas");
    canvas.width = p.width;
    canvas.height = p.height;
    const ctx = canvas.getContext("2d")!;
    renderFrame(ctx, p, this.time, { visual: (clip) => this.source(clip) }, this.edges, this.scratch);
    return canvas;
  }

  private ensureAudio() {
    if (this.audio) {
      if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
      return;
    }
    try {
      this.audio = new AudioContext();
    } catch {
      return;
    }
    for (const entry of this.elements.values()) this.connect(entry);
  }

  private connect(entry: Entry) {
    if (!this.audio || entry.gain) return;
    try {
      const src = this.audio.createMediaElementSource(entry.el);
      entry.gain = this.audio.createGain();
      src.connect(entry.gain).connect(this.audio.destination);
      entry.el.volume = 1;
    } catch {
      entry.gain = null;
    }
  }

  /** Recompute the ducking envelope a moment after the audio-relevant parts of the project settle. */
  private scheduleDuck() {
    const p = this.project;
    if (!p) return;
    const relevant = p.clips
      .filter((c): c is MediaClip => c.type === "media")
      .map((c) => [
        c.id,
        c.mediaId,
        c.start,
        c.duration,
        c.in,
        c.speed,
        c.volume,
        c.duck,
        c.fadeIn,
        c.fadeOut,
        c.trackId,
      ]);
    const key = JSON.stringify([relevant, p.tracks.map((t) => t.muted)]);
    if (key === this.duckKey) return;
    this.duckKey = key;
    clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(async () => {
      const env = await duckEnvelope(p, this.media, projectDuration(p)).catch(() => null);
      if (this.duckKey === key) this.duck = env;
    }, 400);
  }

  private syncElements() {
    if (!this.project) return;
    const live = new Set<string>();
    for (const clip of this.project.clips) {
      if (clip.type !== "media") continue;
      const item = this.media.get(clip.mediaId);
      if (!item) continue;
      if (item.kind === "image") {
        if (!this.images.has(item.id)) {
          const img = new Image();
          img.onload = () => this.requestDraw();
          img.src = item.url;
          this.images.set(item.id, img);
        }
        continue;
      }
      live.add(clip.id);
      const existing = this.elements.get(clip.id);
      if (existing && existing.mediaId === item.id) continue;
      if (existing) this.release(clip.id, existing);
      // Clips on audio tracks only need sound, even when the media is a video.
      const track = this.project.tracks.find((t) => t.id === clip.trackId);
      const el = document.createElement(item.kind === "video" && track?.kind !== "audio" ? "video" : "audio");
      el.preload = "auto";
      el.src = item.url;
      if (el instanceof HTMLVideoElement) el.playsInline = true;
      el.preservesPitch = true;
      el.addEventListener("seeked", () => this.requestDraw());
      el.addEventListener("loadeddata", () => this.requestDraw());
      el.currentTime = clip.in;
      const entry: Entry = { el, mediaId: item.id, gain: null };
      this.connect(entry);
      this.elements.set(clip.id, entry);
    }
    for (const [id, entry] of this.elements) if (!live.has(id)) this.release(id, entry);
  }

  private release(id: string, { el }: Entry) {
    el.pause();
    el.removeAttribute("src");
    el.load();
    this.elements.delete(id);
  }

  private loop() {
    this.raf = 0;
    const p = this.project;
    if (!p) return;

    if (this.playing) {
      const dur = projectDuration(p);
      this.time = this.clockOrigin + ((performance.now() - this.clockStart) / 1000) * this.rate;
      if (this.time >= dur || this.time <= 0) {
        this.time = Math.min(Math.max(this.time, 0), dur);
        this.syncMedia(p);
        this.draw(p);
        this.onTime(this.time);
        this.pause();
        return;
      }
      this.onTime(this.time);
    }

    this.syncMedia(p);
    if (this.playing || this.dirty) {
      this.dirty = false;
      this.draw(p);
    }
    if (this.playing) this.raf = requestAnimationFrame(this.loop);
  }

  private syncMedia(p: Project) {
    const t = this.time;
    const half = 0.5 / p.fps;
    const forward = this.playing && this.rate > 0;
    for (const clip of p.clips) {
      if (clip.type !== "media") continue;
      const entry = this.elements.get(clip.id);
      if (!entry) continue;
      const { el } = entry;
      const item = this.media.get(clip.mediaId);
      // Video picture may run past the clip's edges into a transition; sound never does.
      const [from, to] =
        el instanceof HTMLVideoElement ? visualWindow(clip, this.edges.get(clip.id)) : [clip.start, clipEnd(clip)];
      const active = t >= from && t < to;
      const inside = t >= clip.start && t < clipEnd(clip);
      const maxT = Math.max(0, (item?.duration ?? Number.POSITIVE_INFINITY) - 0.01);
      const target = Math.min(maxT, Math.max(0, sourceTime(clip, t)));
      const track = p.tracks.find((tr) => tr.id === clip.trackId);
      const silent = !track || track.muted || clip.volume <= 0 || !inside || !forward;
      const { fadeIn, fadeOut } = audioFades(clip, this.edges.get(clip.id));
      const level = silent
        ? 0
        : clip.volume * fadeGain(clip, t - clip.start, fadeIn, fadeOut) * (clip.duck ? duckAt(this.duck, t) : 1);
      if (entry.gain) {
        entry.gain.gain.value = level;
        el.muted = level <= 0;
      } else {
        el.muted = level <= 0;
        el.volume = Math.min(1, level);
      }

      if (forward && active) {
        const rate = Math.min(16, Math.max(0.0625, clip.speed * this.rate));
        if (Math.abs(el.playbackRate - rate) > 1e-3) el.playbackRate = rate;
        if (el.paused) {
          if (Math.abs(el.currentTime - target) > 0.05) el.currentTime = target;
          if (target < maxT) el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - target) > DRIFT * Math.max(1, rate)) {
          el.currentTime = target;
        }
      } else {
        if (!el.paused) el.pause();
        if (active && !el.seeking && Math.abs(el.currentTime - target) > half) el.currentTime = target;
        // Pre-roll clips about to start so they begin on the right frame.
        if (!active && forward && from > t && from - t < 1 && !el.seeking) {
          const first = Math.max(0, sourceTime(clip, from));
          if (Math.abs(el.currentTime - first) > 0.05) el.currentTime = first;
        }
      }
    }
  }

  private source(clip: MediaClip) {
    const item = this.media.get(clip.mediaId);
    if (!item) return null;
    if (item.kind === "image") {
      const img = this.images.get(item.id);
      return img?.complete && img.naturalWidth ? imageDrawable(img, img.naturalWidth, img.naturalHeight) : null;
    }
    const el = this.elements.get(clip.id)?.el;
    if (!(el instanceof HTMLVideoElement) || el.readyState < 2 || !el.videoWidth) return null;
    return imageDrawable(el, el.videoWidth, el.videoHeight);
  }

  private draw(p: Project) {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const view = this.editingId ? { ...p, clips: p.clips.filter((c) => c.id !== this.editingId) } : p;
    renderFrame(ctx, view, this.time, { visual: (clip) => this.source(clip) }, this.edges, this.scratch);
  }
}

/**
 * Midpoint of the top edge and the rotate knob, in frame coordinates. The knob
 * sits above the box, or just inside it when above would leave the stage.
 */
export function rotateHandle(g: Geometry, unit: number, W: number, H: number): [[number, number], [number, number]] {
  const { x, y, w } = g.rect;
  const sin = Math.sin(g.rot);
  const cos = Math.cos(g.rot);
  const at = (lx: number, ly: number): [number, number] => [g.cx + lx * cos - ly * sin, g.cy + lx * sin + ly * cos];
  const top = at(x + w / 2, y);
  const out = at(x + w / 2, y - ROTATE_HANDLE_GAP * unit);
  const room = 14 * unit;
  const fits = out[0] > -room && out[0] < W + room && out[1] > -room && out[1] < H + room;
  return [top, fits ? out : at(x + w / 2, y + ROTATE_HANDLE_GAP * unit)];
}

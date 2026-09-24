// Real-time preview for the video editor.
//
// Every media clip gets its own hidden <video>/<audio> element, kept in step with
// a wall-clock timeline: elements play while their clip is under the playhead and
// are re-seeked when they drift. Each frame the visual tracks are composited onto
// the preview canvas with the same drawing helpers the exporter uses.

import {
  type Clip,
  type MediaClip,
  type MediaItem,
  type Project,
  clipEnd,
  drawOrder,
  drawText,
  fadeGain,
  placement,
  projectDuration,
  textBox,
} from "./model";

const MAX_PREVIEW_WIDTH = 1280;
const DRIFT = 0.3;

export interface Rect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export class PreviewEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: Project | null = null;
  private media = new Map<string, MediaItem>();
  private elements = new Map<string, { el: HTMLMediaElement; mediaId: string }>();
  private images = new Map<string, HTMLImageElement>();
  private raf = 0;
  private dirty = true;
  private clockStart = 0;
  private clockOrigin = 0;
  private scale = 1;

  time = 0;
  playing = false;
  selectedId: string | null = null;
  onTime: (t: number) => void = () => {};
  onPlayingChange: (playing: boolean) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.loop = this.loop.bind(this);
  }

  setProject(project: Project, media: Map<string, MediaItem>) {
    const sizeChanged = !this.project || this.project.width !== project.width || this.project.height !== project.height;
    this.project = project;
    this.media = media;
    if (sizeChanged) {
      this.scale = Math.min(1, MAX_PREVIEW_WIDTH / project.width);
      this.canvas.width = Math.round(project.width * this.scale);
      this.canvas.height = Math.round(project.height * this.scale);
    }
    this.syncElements();
    this.requestDraw();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
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

  play() {
    if (!this.project) return;
    const dur = projectDuration(this.project);
    if (dur <= 0) return;
    if (this.time >= dur - 0.01) this.time = 0;
    this.playing = true;
    this.clockOrigin = this.time;
    this.clockStart = performance.now();
    this.onPlayingChange(true);
    this.requestDraw();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
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
    this.raf = 0;
    for (const { el } of this.elements.values()) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    this.elements.clear();
  }

  requestDraw() {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  /** Frame-space rectangle a visual clip currently occupies, or null if it has nothing to show. */
  bounds(clip: Clip): Rect | null {
    if (!this.project) return null;
    const { width: W, height: H } = this.project;
    if (clip.type === "text") return textBox(this.ctx, clip, W, H);
    const item = this.media.get(clip.mediaId);
    if (!item || item.kind === "audio" || !item.width) return null;
    return placement(clip, item.width, item.height, W, H);
  }

  /** Top-most visible clip under a frame-space point at the current time. */
  hitTest(x: number, y: number): string | null {
    if (!this.project) return null;
    const tracks = drawOrder(this.project).reverse();
    for (const track of tracks) {
      for (const clip of this.project.clips) {
        if (clip.trackId !== track.id || this.time < clip.start || this.time >= clipEnd(clip)) continue;
        const r = this.bounds(clip);
        if (r && x >= r.dx && x <= r.dx + r.dw && y >= r.dy && y <= r.dy + r.dh) return clip.id;
      }
    }
    return null;
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
      // Clips on audio tracks only need sound, even when the media is a video.
      const track = this.project.tracks.find((t) => t.id === clip.trackId);
      const el = document.createElement(item.kind === "video" && track?.kind !== "audio" ? "video" : "audio");
      el.preload = "auto";
      el.src = item.url;
      if (el instanceof HTMLVideoElement) el.playsInline = true;
      el.addEventListener("seeked", () => this.requestDraw());
      el.addEventListener("loadeddata", () => this.requestDraw());
      el.currentTime = clip.in;
      this.elements.set(clip.id, { el, mediaId: item.id });
    }
    for (const [id, { el }] of this.elements) {
      if (live.has(id)) continue;
      el.pause();
      el.removeAttribute("src");
      el.load();
      this.elements.delete(id);
    }
  }

  private loop() {
    this.raf = 0;
    const p = this.project;
    if (!p) return;

    if (this.playing) {
      const dur = projectDuration(p);
      this.time = this.clockOrigin + (performance.now() - this.clockStart) / 1000;
      if (this.time >= dur) {
        this.time = dur;
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
    for (const clip of p.clips) {
      if (clip.type !== "media") continue;
      const entry = this.elements.get(clip.id);
      if (!entry) continue;
      const { el } = entry;
      const active = t >= clip.start && t < clipEnd(clip);
      const target = clip.in + (t - clip.start);
      const track = p.tracks.find((tr) => tr.id === clip.trackId);
      el.muted = !track || track.muted || clip.volume <= 0;
      el.volume = Math.min(1, clip.volume * fadeGain(clip, t - clip.start));

      if (this.playing && active) {
        if (el.paused) {
          if (Math.abs(el.currentTime - target) > 0.05) el.currentTime = target;
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - target) > DRIFT) {
          el.currentTime = target;
        }
      } else {
        if (!el.paused) el.pause();
        if (active && !el.seeking && Math.abs(el.currentTime - target) > half) el.currentTime = target;
        // Pre-roll clips about to start so they begin on the right frame.
        if (!active && this.playing && clip.start > t && clip.start - t < 1 && !el.seeking) {
          if (Math.abs(el.currentTime - clip.in) > 0.05) el.currentTime = clip.in;
        }
      }
    }
  }

  private draw(p: Project) {
    const { ctx } = this;
    const W = p.width;
    const H = p.height;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.background;
    ctx.fillRect(0, 0, W, H);

    const t = this.time;
    let selectedRect: Rect | null = null;
    for (const track of drawOrder(p)) {
      for (const clip of p.clips) {
        if (clip.trackId !== track.id || t < clip.start || t >= clipEnd(clip)) continue;
        if (clip.id === this.selectedId) selectedRect = this.bounds(clip);
        if (clip.type === "text") {
          drawText(ctx, clip, W, H);
          continue;
        }
        this.drawMedia(clip, t, W, H);
      }
    }

    if (selectedRect) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3 / this.scale;
      ctx.setLineDash([12 / this.scale, 8 / this.scale]);
      ctx.strokeRect(selectedRect.dx, selectedRect.dy, selectedRect.dw, selectedRect.dh);
      ctx.restore();
    }
  }

  private drawMedia(clip: MediaClip, t: number, W: number, H: number) {
    const item = this.media.get(clip.mediaId);
    if (!item) return;
    const alpha = clip.opacity * fadeGain(clip, t - clip.start);
    const { ctx } = this;
    if (item.kind === "image") {
      const img = this.images.get(item.id);
      if (!img?.complete || !img.naturalWidth) return;
      const r = placement(clip, img.naturalWidth, img.naturalHeight, W, H);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, r.dx, r.dy, r.dw, r.dh);
      ctx.globalAlpha = 1;
      return;
    }
    const el = this.elements.get(clip.id)?.el;
    if (!(el instanceof HTMLVideoElement) || el.readyState < 2 || !el.videoWidth) return;
    const r = placement(clip, el.videoWidth, el.videoHeight, W, H);
    ctx.globalAlpha = alpha;
    ctx.drawImage(el, r.dx, r.dy, r.dw, r.dh);
    ctx.globalAlpha = 1;
  }
}

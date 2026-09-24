// Video editor project model and pure timeline operations.
//
// A project is a stack of tracks holding non-overlapping clips. Visual tracks
// (video, text) composite bottom-up in list order reversed — the track listed
// highest in the timeline draws on top, like every NLE. Audio from video clips
// and audio clips is mixed regardless of track order.

export type MediaKind = "video" | "audio" | "image";
export type TrackKind = "video" | "audio" | "text";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  file: File;
  url: string;
  name: string;
  /** Seconds. Images have no intrinsic length; they get a default clip length. */
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  thumbs: string[];
  /** Peak amplitudes 0–1 spread evenly across the full media duration. */
  peaks: number[];
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
}

interface ClipBase {
  id: string;
  trackId: string;
  /** Timeline position, seconds. */
  start: number;
  duration: number;
  /** Centre of the clip on the frame as a 0–1 fraction of width/height. */
  x: number;
  y: number;
  opacity: number;
}

export interface MediaClip extends ClipBase {
  type: "media";
  mediaId: string;
  /** Source offset into the media, seconds. */
  in: number;
  /** 1 = fit inside the frame. */
  scale: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface TextClip extends ClipBase {
  type: "text";
  text: string;
  /** Font size in px at 1080p; scales with the output height. */
  size: number;
  color: string;
  background: string | null;
  bold: boolean;
}

export type Clip = MediaClip | TextClip;

export interface Project {
  width: number;
  height: number;
  fps: number;
  background: string;
  tracks: Track[];
  clips: Clip[];
}

export const MIN_CLIP = 0.1;
export const IMAGE_DEFAULT_DURATION = 5;
export const TEXT_DEFAULT_DURATION = 3;

let seq = 0;
export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}`;

export function createProject(): Project {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#000000",
    tracks: [
      { id: uid("t"), kind: "text", name: "Text", muted: false, hidden: false },
      { id: uid("t"), kind: "video", name: "Video 2", muted: false, hidden: false },
      { id: uid("t"), kind: "video", name: "Video 1", muted: false, hidden: false },
      { id: uid("t"), kind: "audio", name: "Audio 1", muted: false, hidden: false },
      { id: uid("t"), kind: "audio", name: "Audio 2", muted: false, hidden: false },
    ],
    clips: [],
  };
}

export const clipEnd = (c: Clip) => c.start + c.duration;

export function projectDuration(p: Project): number {
  return p.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
}

export function trackKindFor(kind: MediaKind): TrackKind {
  return kind === "audio" ? "audio" : "video";
}

/** Longest a clip can run from `inPoint`, or Infinity for sources without a length (images, text). */
export function maxSourceLength(clip: Clip, media: MediaItem | undefined, inPoint = clip.type === "media" ? clip.in : 0) {
  if (clip.type !== "media" || !media || media.kind === "image") return Number.POSITIVE_INFINITY;
  return Math.max(MIN_CLIP, media.duration - inPoint);
}

/** Clips on a track other than `excludeId`, sorted by start. */
export function trackClips(p: Project, trackId: string, excludeId?: string): Clip[] {
  return p.clips.filter((c) => c.trackId === trackId && c.id !== excludeId).sort((a, b) => a.start - b.start);
}

/**
 * Nearest start to `desired` where a clip of `duration` fits on the track without
 * overlapping anything. Picks the gap containing `desired` when it fits, otherwise
 * the closest gap that does. The last gap is open-ended, so there is always an answer.
 */
export function findFreeStart(p: Project, trackId: string, desired: number, duration: number, excludeId?: string) {
  const others = trackClips(p, trackId, excludeId);
  const gaps: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const c of others) {
    if (c.start > cursor) gaps.push({ from: cursor, to: c.start });
    cursor = Math.max(cursor, clipEnd(c));
  }
  gaps.push({ from: cursor, to: Number.POSITIVE_INFINITY });

  let best = cursor;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const g of gaps) {
    if (g.to - g.from < duration - 1e-6) continue;
    const s = Math.min(Math.max(desired, g.from), g.to - duration);
    const d = Math.abs(s - desired);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return Math.max(0, best);
}

/** Room around a clip on its track: [earliest start, latest end]. */
export function neighbourBounds(p: Project, clip: Clip) {
  let lo = 0;
  let hi = Number.POSITIVE_INFINITY;
  for (const c of trackClips(p, clip.trackId, clip.id)) {
    if (clipEnd(c) <= clip.start + 1e-6) lo = Math.max(lo, clipEnd(c));
    else if (c.start >= clipEnd(clip) - 1e-6) hi = Math.min(hi, c.start);
  }
  return { lo, hi };
}

export function clipAt(p: Project, trackId: string, t: number): Clip | undefined {
  return p.clips.find((c) => c.trackId === trackId && t >= c.start && t < clipEnd(c));
}

/** Split `clip` at timeline time `t`; returns the project unchanged if `t` is not inside it. */
export function splitClip(p: Project, clipId: string, t: number): Project {
  const clip = p.clips.find((c) => c.id === clipId);
  if (!clip || t <= clip.start + MIN_CLIP / 2 || t >= clipEnd(clip) - MIN_CLIP / 2) return p;
  const offset = t - clip.start;
  const left: Clip = { ...clip, duration: offset };
  const right: Clip =
    clip.type === "media"
      ? { ...clip, id: uid("c"), start: t, duration: clip.duration - offset, in: clip.in + offset }
      : { ...clip, id: uid("c"), start: t, duration: clip.duration - offset };
  // A fade belongs to the outer edge of the original clip only.
  if (left.type === "media") left.fadeOut = 0;
  if (right.type === "media") right.fadeIn = 0;
  return { ...p, clips: p.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])) };
}

export function updateClip(p: Project, clipId: string, patch: Partial<MediaClip> | Partial<TextClip>): Project {
  return { ...p, clips: p.clips.map((c) => (c.id === clipId ? ({ ...c, ...patch } as Clip) : c)) };
}

export function removeClips(p: Project, ids: Set<string>): Project {
  return { ...p, clips: p.clips.filter((c) => !ids.has(c.id)) };
}

/** Snap `t` to the nearest candidate within `threshold` seconds. */
export function snap(t: number, candidates: number[], threshold: number): number {
  let best = t;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - t);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** Linear fade multiplier for a media clip at local time `local` (seconds into the clip). */
export function fadeGain(clip: MediaClip, local: number): number {
  let g = 1;
  if (clip.fadeIn > 0 && local < clip.fadeIn) g = Math.min(g, local / clip.fadeIn);
  const tail = clip.duration - local;
  if (clip.fadeOut > 0 && tail < clip.fadeOut) g = Math.min(g, tail / clip.fadeOut);
  return Math.max(0, Math.min(1, g));
}

/** Visual tracks in draw order: bottom of the stack first. */
export function drawOrder(p: Project): Track[] {
  return p.tracks.filter((t) => t.kind !== "audio" && !t.hidden).reverse();
}

// ── Drawing (shared by preview and export) ────────────────────

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Where a visual source of `w`×`h` lands on the frame for a clip. */
export function placement(clip: MediaClip, w: number, h: number, W: number, H: number) {
  const fit = Math.min(W / w, H / h) * clip.scale;
  const dw = w * fit;
  const dh = h * fit;
  return { dx: clip.x * W - dw / 2, dy: clip.y * H - dh / 2, dw, dh };
}

function textLines(clip: TextClip, H: number) {
  const px = (clip.size * H) / 1080;
  const lines = clip.text.split("\n");
  return { px, lines, lineH: px * 1.2 };
}

export function textFont(clip: TextClip, H: number) {
  return `${clip.bold ? "700" : "400"} ${(clip.size * H) / 1080}px "Inter", system-ui, sans-serif`;
}

export function drawText(ctx: Ctx2D, clip: TextClip, W: number, H: number, opacity = clip.opacity) {
  const { px, lines, lineH } = textLines(clip, H);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = textFont(clip, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = clip.x * W;
  const top = clip.y * H - (lines.length * lineH) / 2;
  if (clip.background) {
    const pad = px * 0.35;
    const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.fillStyle = clip.background;
    ctx.fillRect(cx - width / 2 - pad, top - pad * 0.6, width + pad * 2, lines.length * lineH + pad * 1.2);
  }
  ctx.fillStyle = clip.color;
  lines.forEach((l, i) => {
    ctx.fillText(l, cx, top + lineH * (i + 0.5));
  });
  ctx.restore();
}

/** Bounding box of a text clip in frame pixels, for hit-testing and selection outlines. */
export function textBox(ctx: Ctx2D, clip: TextClip, W: number, H: number) {
  const { px, lines, lineH } = textLines(clip, H);
  ctx.save();
  ctx.font = textFont(clip, H);
  const width = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
  ctx.restore();
  const pad = px * 0.35;
  const h = lines.length * lineH;
  return { dx: clip.x * W - width / 2 - pad, dy: clip.y * H - h / 2 - pad * 0.6, dw: width + pad * 2, dh: h + pad * 1.2 };
}

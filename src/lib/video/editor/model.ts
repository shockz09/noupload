// Video editor project model and pure timeline operations.
//
// A project is a stack of tracks holding non-overlapping clips. Visual tracks
// (video, text) composite bottom-up in list order reversed — the track listed
// highest in the timeline draws on top, like every NLE. Audio from video clips
// and audio clips is mixed regardless of track order.
//
// Clips sharing a `linkId` (a video and its separated audio, say) move, trim,
// split and delete together. Animatable properties can carry keyframes, in
// seconds from the clip's start; a property with keyframes ignores its static
// value.

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

export type AnimProp = "x" | "y" | "scale" | "opacity" | "rotation";
export const ANIM_PROPS: AnimProp[] = ["x", "y", "scale", "opacity", "rotation"];

export interface Keyframe {
  /** Seconds from the clip's start. */
  t: number;
  v: number;
}
export type Keyframes = Partial<Record<AnimProp, Keyframe[]>>;

/** The animatable values of a clip at one moment. */
export type Pose = Record<AnimProp, number>;

interface ClipBase {
  id: string;
  trackId: string;
  /** Timeline position, seconds. */
  start: number;
  duration: number;
  /** Centre of the clip on the frame as a 0–1 fraction of width/height. */
  x: number;
  y: number;
  /** 1 = fit inside the frame (media) or the text's own size. */
  scale: number;
  opacity: number;
  /** Degrees, clockwise. */
  rotation: number;
  keyframes: Keyframes;
  linkId: string | null;
}

/** Fractions of the source cut from each visible edge. */
export interface Crop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Each -1…1, 0 leaves the picture alone. */
export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
}

export type TransitionKind = "crossfade" | "dip";

/** A transition into a clip, centred on the cut with the clip before it. */
export interface Transition {
  kind: TransitionKind;
  duration: number;
}

export interface MediaClip extends ClipBase {
  type: "media";
  mediaId: string;
  /** Source offset into the media, seconds. */
  in: number;
  /** Playback rate: 2 plays the source twice as fast. */
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  flipH: boolean;
  flipV: boolean;
  crop: Crop;
  color: ColorAdjust;
  transition: Transition | null;
  /** Lower this clip's audio while other audio is playing. */
  duck: boolean;
}

export type TextFont = "sans" | "serif" | "mono" | "heavy";
export type TextAlign = "left" | "center" | "right";
export type TextAnim = "none" | "fade" | "slide" | "pop" | "type";

export interface TextClip extends ClipBase {
  type: "text";
  text: string;
  /** Font size in px at 1080p; scales with the output height. */
  size: number;
  color: string;
  background: string | null;
  bold: boolean;
  italic: boolean;
  font: TextFont;
  align: TextAlign;
  outline: string | null;
  shadow: boolean;
  animIn: TextAnim;
  animOut: TextAnim;
}

export type Clip = MediaClip | TextClip;

export interface Marker {
  id: string;
  time: number;
}

export interface Project {
  width: number;
  height: number;
  fps: number;
  background: string;
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
}

export const MIN_CLIP = 0.1;
export const IMAGE_DEFAULT_DURATION = 5;
export const TEXT_DEFAULT_DURATION = 3;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
export const MAX_VOLUME = 3;
/** Gain applied to ducked audio while something else is audible (≈ -12 dB). */
export const DUCK_LEVEL = 0.25;
const EPS = 1e-3;

let seq = 0;
export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}`;

export const NO_CROP: Crop = { left: 0, top: 0, right: 0, bottom: 0 };
export const NEUTRAL_COLOR: ColorAdjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 };

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
    markers: [],
  };
}

const BASE_DEFAULTS = { x: 0.5, y: 0.5, scale: 1, opacity: 1, rotation: 0, linkId: null };

export function newMediaClip(
  fields: Pick<MediaClip, "id" | "trackId" | "mediaId" | "start" | "duration"> & Partial<MediaClip>,
): MediaClip {
  return {
    ...BASE_DEFAULTS,
    in: 0,
    speed: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    flipH: false,
    flipV: false,
    crop: NO_CROP,
    color: NEUTRAL_COLOR,
    transition: null,
    duck: false,
    ...fields,
    keyframes: fields.keyframes ?? {},
    type: "media",
  };
}

export function newTextClip(
  fields: Pick<TextClip, "id" | "trackId" | "start" | "duration"> & Partial<TextClip>,
): TextClip {
  return {
    ...BASE_DEFAULTS,
    text: "Your text",
    size: 96,
    color: "#ffffff",
    background: null,
    bold: true,
    italic: false,
    font: "sans",
    align: "center",
    outline: null,
    shadow: false,
    animIn: "none",
    animOut: "none",
    ...fields,
    keyframes: fields.keyframes ?? {},
    type: "text",
  };
}

/** Fill in fields added since a project was saved, so older autosaves load. */
export function normalizeProject(p: Project): Project {
  const clips = p.clips.map((c): Clip => {
    const base = { ...c, keyframes: c.keyframes ?? {}, linkId: c.linkId ?? null };
    if (c.type === "media") {
      return newMediaClip({
        ...(base as MediaClip),
        crop: { ...NO_CROP, ...(c as Partial<MediaClip>).crop },
        color: { ...NEUTRAL_COLOR, ...(c as Partial<MediaClip>).color },
      });
    }
    const font = (c as Partial<TextClip>).font;
    return newTextClip({ ...(base as TextClip), font: font && font in FONT_STACKS ? font : "sans" });
  });
  return { ...p, clips, markers: p.markers ?? [] };
}

export const clipEnd = (c: Clip) => c.start + c.duration;

export function projectDuration(p: Project): number {
  return p.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
}

export function trackKindFor(kind: MediaKind): TrackKind {
  return kind === "audio" ? "audio" : "video";
}

/** Source seconds shown at timeline time `t`, unclamped. */
export function sourceTime(clip: MediaClip, t: number) {
  return clip.in + (t - clip.start) * clip.speed;
}

/** Longest a clip can run on the timeline from `inPoint`, or Infinity for sources without a length (images, text). */
export function maxSourceLength(
  clip: Clip,
  media: MediaItem | undefined,
  inPoint = clip.type === "media" ? clip.in : 0,
) {
  if (clip.type !== "media" || !media || media.kind === "image") return Number.POSITIVE_INFINITY;
  return Math.max(MIN_CLIP, (media.duration - inPoint) / clip.speed);
}

/** Clips on a track other than `excludeId`, sorted by start. */
export function trackClips(p: Project, trackId: string, excludeId?: string | Set<string>): Clip[] {
  const skip = (id: string) => (typeof excludeId === "string" ? id === excludeId : !!excludeId?.has(id));
  return p.clips.filter((c) => c.trackId === trackId && !skip(c.id)).sort((a, b) => a.start - b.start);
}

/**
 * Nearest start to `desired` where a clip of `duration` fits on the track without
 * overlapping anything. Picks the gap containing `desired` when it fits, otherwise
 * the closest gap that does. The last gap is open-ended, so there is always an answer.
 */
export function findFreeStart(
  p: Project,
  trackId: string,
  desired: number,
  duration: number,
  excludeId?: string | Set<string>,
) {
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
export function neighbourBounds(p: Project, clip: Clip, exclude?: Set<string>) {
  let lo = 0;
  let hi = Number.POSITIVE_INFINITY;
  for (const c of trackClips(p, clip.trackId, exclude ?? clip.id)) {
    if (c.id === clip.id) continue;
    if (clipEnd(c) <= clip.start + 1e-6) lo = Math.max(lo, clipEnd(c));
    else if (c.start >= clipEnd(clip) - 1e-6) hi = Math.min(hi, c.start);
  }
  return { lo, hi };
}

export function clipAt(p: Project, trackId: string, t: number): Clip | undefined {
  return p.clips.find((c) => c.trackId === trackId && t >= c.start && t < clipEnd(c));
}

/** `ids` plus every clip linked to one of them. */
export function withLinked(p: Project, ids: Iterable<string>): Set<string> {
  const out = new Set(ids);
  const links = new Set(p.clips.filter((c) => out.has(c.id) && c.linkId).map((c) => c.linkId));
  if (links.size) for (const c of p.clips) if (c.linkId && links.has(c.linkId)) out.add(c.id);
  return out;
}

/** Clips that share `clip`'s link, not including it. */
export function partners(p: Project, clip: Clip): Clip[] {
  return clip.linkId ? p.clips.filter((c) => c.linkId === clip.linkId && c.id !== clip.id) : [];
}

// ── Keyframes ─────────────────────────────────────────────────

const ease = (p: number) => p * p * (3 - 2 * p);

export function valueAt(kfs: Keyframe[] | undefined, local: number, fallback: number): number {
  if (!kfs?.length) return fallback;
  if (local <= kfs[0].t) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (local >= last.t) return last.v;
  let i = 1;
  while (kfs[i].t < local) i++;
  const a = kfs[i - 1];
  const b = kfs[i];
  return a.v + (b.v - a.v) * ease((local - a.t) / (b.t - a.t || 1));
}

export function poseAt(clip: Clip, local: number): Pose {
  const k = clip.keyframes;
  return {
    x: valueAt(k.x, local, clip.x),
    y: valueAt(k.y, local, clip.y),
    scale: valueAt(k.scale, local, clip.scale),
    opacity: valueAt(k.opacity, local, clip.opacity),
    rotation: valueAt(k.rotation, local, clip.rotation),
  };
}

export const isAnimated = (clip: Clip, prop: AnimProp) => (clip.keyframes[prop]?.length ?? 0) > 0;

export function keyframeIndex(clip: Clip, prop: AnimProp, local: number, tol: number) {
  return clip.keyframes[prop]?.findIndex((k) => Math.abs(k.t - local) <= tol) ?? -1;
}

function withKey(kfs: Keyframe[] | undefined, local: number, v: number, tol: number): Keyframe[] {
  const list = (kfs ?? []).filter((k) => Math.abs(k.t - local) > tol);
  list.push({ t: local, v });
  return list.sort((a, b) => a.t - b.t);
}

/**
 * Set animatable values at `local`: a property with keyframes gets a keyframe
 * there, anything else changes its static value.
 */
export function applyPose<C extends Clip>(clip: C, patch: Partial<Pose>, local: number, tol: number): C {
  let keyframes = clip.keyframes;
  const statics: Partial<Pose> = {};
  for (const prop of Object.keys(patch) as AnimProp[]) {
    const v = patch[prop]!;
    if (isAnimated(clip, prop)) keyframes = { ...keyframes, [prop]: withKey(keyframes[prop], local, v, tol) };
    else statics[prop] = v;
  }
  return { ...clip, ...statics, keyframes };
}

/** Add a keyframe at `local` holding the current value, or remove the one already there. */
export function toggleKeyframe<C extends Clip>(clip: C, prop: AnimProp, local: number, tol: number): C {
  const i = keyframeIndex(clip, prop, local, tol);
  const kfs = clip.keyframes[prop] ?? [];
  if (i >= 0) {
    const rest = kfs.filter((_, j) => j !== i);
    // Dropping the last keyframe leaves the property holding the value it had there.
    if (rest.length === 0) {
      const { [prop]: _gone, ...keyframes } = clip.keyframes;
      return { ...clip, [prop]: kfs[i].v, keyframes };
    }
    return { ...clip, keyframes: { ...clip.keyframes, [prop]: rest } };
  }
  const v = poseAt(clip, local)[prop];
  return { ...clip, keyframes: { ...clip.keyframes, [prop]: withKey(kfs, local, v, tol) } };
}

/** Keyframe times re-based after the clip's start moved by `shift` (timeline seconds) and its rate scaled by `rate`. */
function remapKeyframes(k: Keyframes, shift: number, rate = 1): Keyframes {
  const out: Keyframes = {};
  for (const prop of Object.keys(k) as AnimProp[])
    out[prop] = k[prop]!.map((f) => ({ t: (f.t - shift) * rate, v: f.v }));
  return out;
}

/** Every keyframe time on a clip, deduplicated, for drawing on the timeline. */
export function keyframeTimes(clip: Clip): number[] {
  const times: number[] = [];
  for (const prop of ANIM_PROPS) {
    for (const k of clip.keyframes[prop] ?? []) if (!times.some((t) => Math.abs(t - k.t) < EPS)) times.push(k.t);
  }
  return times.sort((a, b) => a - b);
}

// ── Timeline operations ───────────────────────────────────────

function splitOne(clip: Clip, t: number, rightId: string, rightLink: string | null): [Clip, Clip] {
  const offset = t - clip.start;
  const atCut = poseAt(clip, offset);
  // Each half keeps its keyframes, plus one at the cut so the motion carries across it.
  const leftK: Keyframes = {};
  const rightK: Keyframes = {};
  for (const prop of Object.keys(clip.keyframes) as AnimProp[]) {
    const kfs = clip.keyframes[prop]!;
    if (!kfs.length) continue;
    leftK[prop] = [...kfs.filter((k) => k.t < offset - EPS), { t: offset, v: atCut[prop] }];
    rightK[prop] = [
      { t: 0, v: atCut[prop] },
      ...kfs.filter((k) => k.t > offset + EPS).map((k) => ({ t: k.t - offset, v: k.v })),
    ];
  }
  const left = { ...clip, duration: offset, keyframes: leftK } as Clip;
  const right = {
    ...clip,
    id: rightId,
    linkId: rightLink,
    start: t,
    duration: clip.duration - offset,
    keyframes: rightK,
  } as Clip;
  if (right.type === "media" && clip.type === "media") right.in = clip.in + offset * clip.speed;
  // A fade belongs to the outer edge of the original clip only, and so does a transition.
  if (left.type === "media") left.fadeOut = 0;
  if (right.type === "media") {
    right.fadeIn = 0;
    right.transition = null;
  }
  if (left.type === "text") left.animOut = "none";
  if (right.type === "text") right.animIn = "none";
  return [left, right];
}

/**
 * Split the given clips (and anything linked to them) at `t`. The right halves
 * of a linked group stay linked to each other.
 */
export function splitClips(p: Project, ids: Iterable<string>, t: number): Project {
  const targets = withLinked(p, ids);
  const newLinks = new Map<string, string>();
  let changed = false;
  const clips = p.clips.flatMap((c) => {
    if (!targets.has(c.id) || t <= c.start + MIN_CLIP / 2 || t >= clipEnd(c) - MIN_CLIP / 2) return [c];
    changed = true;
    let link: string | null = null;
    if (c.linkId) {
      if (!newLinks.has(c.linkId)) newLinks.set(c.linkId, uid("l"));
      link = newLinks.get(c.linkId)!;
    }
    return splitOne(c, t, uid("c"), link);
  });
  return changed ? { ...p, clips } : p;
}

/** Split `clip` at timeline time `t`; returns the project unchanged if `t` is not inside it. */
export function splitClip(p: Project, clipId: string, t: number): Project {
  return splitClips(p, [clipId], t);
}

export function updateClip(p: Project, clipId: string, patch: Partial<MediaClip> | Partial<TextClip>): Project {
  return { ...p, clips: p.clips.map((c) => (c.id === clipId ? ({ ...c, ...patch } as Clip) : c)) };
}

export function mapClip(p: Project, clipId: string, fn: (c: Clip) => Clip): Project {
  return { ...p, clips: p.clips.map((c) => (c.id === clipId ? fn(c) : c)) };
}

export function removeClips(p: Project, ids: Set<string>): Project {
  return { ...p, clips: p.clips.filter((c) => !ids.has(c.id)) };
}

/**
 * Shift every clip on `trackIds` starting at or after `t` by `amount` (and the
 * clips linked to them), keeping each linked group in sync. Negative amounts
 * are limited so nothing overlaps.
 */
export function rippleShift(p: Project, trackIds: Iterable<string>, t: number, amount: number): Project {
  const tracks = new Set(trackIds);
  const moving = withLinked(
    p,
    p.clips.filter((c) => tracks.has(c.trackId) && c.start >= t - EPS).map((c) => c.id),
  );
  if (moving.size === 0 || Math.abs(amount) < EPS) return p;
  let delta = amount;
  if (delta < 0) {
    for (const c of p.clips) {
      if (!moving.has(c.id)) continue;
      const { lo } = neighbourBounds(p, c, moving);
      delta = Math.max(delta, lo - c.start);
    }
  } else {
    for (const c of p.clips) {
      if (!moving.has(c.id)) continue;
      const { hi } = neighbourBounds(p, c, moving);
      // Something unmoved sits after a linked partner: there is no room to push into.
      if (hi < Number.POSITIVE_INFINITY) delta = Math.min(delta, hi - clipEnd(c));
    }
  }
  if (Math.abs(delta) < EPS) return p;
  return { ...p, clips: p.clips.map((c) => (moving.has(c.id) ? { ...c, start: c.start + delta } : c)) };
}

/** Empty space on a track around `t`, or null if `t` is inside a clip. */
export function gapAt(p: Project, trackId: string, t: number): { from: number; to: number } | null {
  let from = 0;
  for (const c of trackClips(p, trackId)) {
    if (t >= c.start && t < clipEnd(c)) return null;
    if (clipEnd(c) <= t + EPS) from = Math.max(from, clipEnd(c));
    else return { from, to: c.start };
  }
  return null; // past the last clip there is nothing to close
}

/** Pull everything after the gap at `t` left to close it. */
export function closeGap(p: Project, trackId: string, t: number): Project {
  const gap = gapAt(p, trackId, t);
  if (!gap) return p;
  return rippleShift(p, [trackId], gap.to, gap.from - gap.to);
}

/** Delete clips and pull what follows left by their length, so any gap that was already there stays. */
export function rippleDelete(p: Project, ids: Iterable<string>): Project {
  const targets = withLinked(p, ids);
  const removed = p.clips.filter((c) => targets.has(c.id)).sort((a, b) => b.start - a.start);
  let next = removeClips(p, targets);
  for (const c of removed) next = rippleShift(next, [c.trackId], clipEnd(c), -c.duration);
  return next;
}

/** Cut the part of each clip before (`start`) or after (`end`) the playhead. */
export function trimToTime(p: Project, ids: Iterable<string>, t: number, side: "start" | "end"): Project {
  const targets = withLinked(p, ids);
  let changed = false;
  const clips = p.clips.map((c): Clip => {
    if (!targets.has(c.id) || t <= c.start + MIN_CLIP / 2 || t >= clipEnd(c) - MIN_CLIP / 2) return c;
    changed = true;
    if (side === "end") return { ...c, duration: t - c.start, ...(c.type === "media" ? { fadeOut: 0 } : {}) } as Clip;
    const shift = t - c.start;
    const moved = { ...c, start: t, duration: c.duration - shift, keyframes: remapKeyframes(c.keyframes, shift) };
    return moved.type === "media" && c.type === "media"
      ? { ...moved, in: c.in + shift * c.speed, fadeIn: 0, transition: null }
      : moved;
  });
  return changed ? { ...p, clips } : p;
}

/**
 * Change a media clip's speed, keeping its in point. The clip (and its linked
 * partners) grows or shrinks on the timeline, limited by the next clip and the
 * end of the source.
 */
export function setSpeed(p: Project, clipId: string, speed: number, media: Map<string, MediaItem>): Project {
  const clip = p.clips.find((c) => c.id === clipId);
  if (!clip || clip.type !== "media") return p;
  const s = Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
  const group = [clip, ...partners(p, clip)].filter((c): c is MediaClip => c.type === "media");
  const ids = new Set(group.map((c) => c.id));
  const rate = clip.speed / s;
  let duration = clip.duration * rate;
  for (const c of group) {
    duration = Math.min(duration, neighbourBounds(p, c, ids).hi - c.start);
    duration = Math.min(duration, maxSourceLength({ ...c, speed: s }, media.get(c.mediaId)));
  }
  duration = Math.max(MIN_CLIP, duration);
  return {
    ...p,
    clips: p.clips.map((c) =>
      ids.has(c.id) && c.type === "media"
        ? { ...c, speed: s, duration, keyframes: remapKeyframes(c.keyframes, 0, c.speed / s) }
        : c,
    ),
  };
}

/** Give the clips one shared link, or clear it. */
export function setLink(p: Project, ids: Iterable<string>, linked: boolean): Project {
  const targets = withLinked(p, ids);
  const link = linked ? uid("l") : null;
  return { ...p, clips: p.clips.map((c) => (targets.has(c.id) ? { ...c, linkId: link } : c)) };
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
export function fadeGain(clip: MediaClip, local: number, fadeIn = clip.fadeIn, fadeOut = clip.fadeOut): number {
  const l = Math.min(Math.max(local, 0), clip.duration);
  let g = 1;
  if (fadeIn > 0 && l < fadeIn) g = Math.min(g, l / fadeIn);
  const tail = clip.duration - l;
  if (fadeOut > 0 && tail < fadeOut) g = Math.min(g, tail / fadeOut);
  return Math.max(0, Math.min(1, g));
}

/** Visual tracks in draw order: bottom of the stack first. */
export function drawOrder(p: Project): Track[] {
  return p.tracks.filter((t) => t.kind !== "audio" && !t.hidden).reverse();
}

// ── Transitions ───────────────────────────────────────────────

export interface ClipEdges {
  /** Transition into the clip; `joined` when it blends with the clip before it. */
  in?: { kind: TransitionKind; d: number; joined: boolean };
  /** The next clip's transition, which this clip runs on into. */
  out?: { kind: TransitionKind; d: number };
}

/** Resolve each clip's transitions against its neighbours on the track. */
export function transitionMap(p: Project): Map<string, ClipEdges> {
  const map = new Map<string, ClipEdges>();
  for (const track of p.tracks) {
    const clips = trackClips(p, track.id);
    clips.forEach((c, i) => {
      if (c.type !== "media" || !c.transition || c.transition.duration <= 0) return;
      const prev = clips[i - 1];
      const joined = !!prev && prev.type === "media" && Math.abs(clipEnd(prev) - c.start) < EPS;
      let d = Math.min(c.transition.duration, c.duration);
      if (joined) d = Math.min(d, prev.duration);
      const edges = map.get(c.id) ?? {};
      edges.in = { kind: c.transition.kind, d, joined };
      map.set(c.id, edges);
      if (joined) {
        const pe = map.get(prev.id) ?? {};
        pe.out = { kind: c.transition.kind, d };
        map.set(prev.id, pe);
      }
    });
  }
  return map;
}

/** When a clip is on screen: transitions let it start early and run on past its end. */
export function visualWindow(clip: Clip, edges: ClipEdges | undefined): [number, number] {
  const from = clip.start - (edges?.in?.joined ? edges.in.d / 2 : 0);
  const to = clipEnd(clip) + (edges?.out ? edges.out.d / 2 : 0);
  return [from, to];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Opacity multiplier from transitions at timeline time `t`. */
export function transitionAlpha(clip: Clip, edges: ClipEdges | undefined, t: number): number {
  let a = 1;
  const inn = edges?.in;
  if (inn) {
    const from = inn.joined ? clip.start - inn.d / 2 : clip.start;
    const p = clamp01((t - from) / inn.d);
    a *= inn.joined && inn.kind === "dip" ? clamp01(2 * p - 1) : p;
  }
  const out = edges?.out;
  if (out?.kind === "dip") a *= clamp01(1 - 2 * clamp01((t - (clipEnd(clip) - out.d / 2)) / out.d));
  return a;
}

/** Fades an audio clip gets, its own plus the ones its transitions imply. */
export function audioFades(clip: MediaClip, edges: ClipEdges | undefined) {
  const tin = edges?.in ? (edges.in.joined ? edges.in.d / 2 : edges.in.d) : 0;
  const tout = edges?.out ? edges.out.d / 2 : 0;
  return { fadeIn: Math.max(clip.fadeIn, tin), fadeOut: Math.max(clip.fadeOut, tout) };
}

// ── Geometry ─────────────────────────────────────────────────

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Where a visual clip sits on the frame: a rectangle `rect` in coordinates
 * centred on (cx, cy) and rotated by `rot` radians.
 */
export interface Geometry {
  cx: number;
  cy: number;
  rot: number;
  rect: { x: number; y: number; w: number; h: number };
}

/** Size a `w`×`h` source is drawn at for a clip at `scale`, before cropping. */
export function fittedSize(w: number, h: number, W: number, H: number, scale: number) {
  const fit = Math.min(W / w, H / h) * scale;
  return { fw: w * fit, fh: h * fit };
}

export function mediaGeometry(clip: MediaClip, pose: Pose, w: number, h: number, W: number, H: number): Geometry {
  const { fw, fh } = fittedSize(w, h, W, H, pose.scale);
  const c = clip.crop;
  return {
    cx: pose.x * W,
    cy: pose.y * H,
    rot: (pose.rotation * Math.PI) / 180,
    rect: {
      x: -fw / 2 + c.left * fw,
      y: -fh / 2 + c.top * fh,
      w: fw * (1 - c.left - c.right),
      h: fh * (1 - c.top - c.bottom),
    },
  };
}

export function geometryCorners(g: Geometry): [number, number][] {
  const { x, y, w, h } = g.rect;
  const cos = Math.cos(g.rot);
  const sin = Math.sin(g.rot);
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ].map(([px, py]) => [g.cx + px * cos - py * sin, g.cy + px * sin + py * cos]);
}

/** Frame point into the clip's own (unrotated, centred) coordinates. */
export function toLocal(g: Geometry, x: number, y: number) {
  const dx = x - g.cx;
  const dy = y - g.cy;
  const cos = Math.cos(-g.rot);
  const sin = Math.sin(-g.rot);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

export function hitGeometry(g: Geometry, x: number, y: number, pad = 0) {
  const l = toLocal(g, x, y);
  const { rect: r } = g;
  return l.x >= r.x - pad && l.x <= r.x + r.w + pad && l.y >= r.y - pad && l.y <= r.y + r.h + pad;
}

// ── Drawing (shared by preview and export) ────────────────────

/** Anything a frame can be drawn from: an element, a bitmap, a decoded sample. */
export interface Drawable {
  width: number;
  height: number;
  draw(
    ctx: Ctx2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

export function imageDrawable(src: CanvasImageSource, width: number, height: number): Drawable {
  return {
    width,
    height,
    draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh),
  };
}

const hasCanvasFilter = (ctx: Ctx2D) => "filter" in ctx;

export function isNeutral(c: ColorAdjust) {
  return !c.brightness && !c.contrast && !c.saturation && !c.temperature;
}

/** CSS filter for brightness, contrast and saturation; temperature is a tint drawn separately. */
export function colorFilter(c: ColorAdjust): string {
  const parts: string[] = [];
  if (c.brightness) parts.push(`brightness(${(1 + c.brightness * 0.6).toFixed(3)})`);
  if (c.contrast) parts.push(`contrast(${(1 + c.contrast * 0.7).toFixed(3)})`);
  if (c.saturation) parts.push(`saturate(${(1 + c.saturation).toFixed(3)})`);
  return parts.join(" ") || "none";
}

/** A scratch canvas for effects that need the clip on its own first. */
export type Scratch = () => OffscreenCanvas | HTMLCanvasElement;

export function createScratch(): Scratch {
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  return () => {
    if (!canvas)
      canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(16, 16) : document.createElement("canvas");
    return canvas;
  };
}

const SCRATCH_MAX = 1920;

export function drawMedia(
  ctx: Ctx2D,
  clip: MediaClip,
  pose: Pose,
  src: Drawable,
  W: number,
  H: number,
  alpha: number,
  scratch?: Scratch,
) {
  if (alpha <= 0) return;
  const { fw, fh } = fittedSize(src.width, src.height, W, H, pose.scale);
  const c = clip.crop;
  // Crop is in what the viewer sees; with a flip, the visible left edge is the source's right.
  const l = clip.flipH ? c.right : c.left;
  const r = clip.flipH ? c.left : c.right;
  const t = clip.flipV ? c.bottom : c.top;
  const b = clip.flipV ? c.top : c.bottom;
  const sw = src.width * (1 - l - r);
  const sh = src.height * (1 - t - b);
  if (sw <= 0 || sh <= 0) return;
  const dx = -fw / 2 + l * fw;
  const dy = -fh / 2 + t * fh;
  const dw = fw * (1 - l - r);
  const dh = fh * (1 - t - b);

  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(pose.x * W, pose.y * H);
  if (pose.rotation) ctx.rotate((pose.rotation * Math.PI) / 180);
  if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);
  const filter = hasCanvasFilter(ctx) ? colorFilter(clip.color) : "none";
  const temp = clip.color.temperature;
  if (temp && scratch) {
    // Tint only the clip's own pixels, so layers underneath keep their colour.
    const k = Math.min(1, SCRATCH_MAX / Math.max(dw, dh));
    const cw = Math.max(1, Math.round(dw * k));
    const ch = Math.max(1, Math.round(dh * k));
    const canvas = scratch();
    if (canvas.width < cw || canvas.height < ch) {
      canvas.width = Math.max(canvas.width, cw);
      canvas.height = Math.max(canvas.height, ch);
    }
    const sctx = canvas.getContext("2d") as Ctx2D;
    sctx.save();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, cw, ch);
    if (filter !== "none") sctx.filter = filter;
    src.draw(sctx, src.width * l, src.height * t, sw, sh, 0, 0, cw, ch);
    sctx.filter = "none";
    sctx.globalCompositeOperation = "source-atop";
    sctx.globalAlpha = Math.abs(temp) * 0.28;
    sctx.fillStyle = temp > 0 ? "#ff8a1f" : "#2f7bff";
    sctx.fillRect(0, 0, cw, ch);
    sctx.restore();
    ctx.drawImage(canvas, 0, 0, cw, ch, dx, dy, dw, dh);
  } else {
    if (filter !== "none") ctx.filter = filter;
    src.draw(ctx, src.width * l, src.height * t, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

export const FONT_STACKS: Record<TextFont, string> = {
  sans: '"Onest", system-ui, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  heavy: 'Impact, "Arial Black", "Helvetica Neue", sans-serif',
};

export function textFont(clip: TextClip, H: number, scale = 1) {
  const px = (clip.size * H * scale) / 1080;
  return `${clip.italic ? "italic " : ""}${clip.bold ? "700" : "400"} ${px}px ${FONT_STACKS[clip.font]}`;
}

/** Fonts the text clips need, for waiting on before an export. */
export function projectFonts(p: Project) {
  return [...new Set(p.clips.filter((c): c is TextClip => c.type === "text").map((c) => textFont(c, 1080)))];
}

function textLayout(ctx: Ctx2D, clip: TextClip, H: number, scale: number) {
  const px = (clip.size * H * scale) / 1080;
  const lines = clip.text.split("\n");
  ctx.save();
  ctx.font = textFont(clip, H, scale);
  const widths = lines.map((l) => ctx.measureText(l).width);
  ctx.restore();
  const lineH = px * 1.2;
  const width = Math.max(1, ...widths);
  const pad = px * 0.35;
  return { px, lines, widths, lineH, width, pad, height: lines.length * lineH };
}

export function textGeometry(ctx: Ctx2D, clip: TextClip, pose: Pose, W: number, H: number): Geometry {
  const { width, height, pad } = textLayout(ctx, clip, H, pose.scale);
  return {
    cx: pose.x * W,
    cy: pose.y * H,
    rot: (pose.rotation * Math.PI) / 180,
    rect: { x: -width / 2 - pad, y: -height / 2 - pad * 0.6, w: width + pad * 2, h: height + pad * 1.2 },
  };
}

/** How a text clip's in/out animations affect it at `local` seconds in. */
export function textAnimation(clip: TextClip, local: number) {
  const d = Math.min(0.5, clip.duration / 3);
  const typeD = Math.min(clip.duration * 0.6, Math.max(0.3, clip.text.length * 0.045));
  let alpha = 1;
  let dy = 0;
  let scale = 1;
  let chars: number | null = null;
  const apply = (anim: TextAnim, p: number, dir: 1 | -1) => {
    const e = ease(clamp01(p));
    if (anim === "fade") alpha *= e;
    else if (anim === "slide") {
      alpha *= e;
      dy += (1 - e) * 0.05 * dir;
    } else if (anim === "pop") {
      const q = clamp01(p);
      // Overshoots a touch before settling, like a pop should.
      const back = 1 + 2.2 * (q - 1) ** 3 + 1.2 * (q - 1) ** 2;
      scale *= 0.5 + 0.5 * back;
      alpha *= clamp01(q * 3);
    }
  };
  if (clip.animIn === "type") chars = Math.floor(clip.text.length * clamp01(local / typeD));
  else apply(clip.animIn, local / d, 1);
  if (clip.animOut === "type") {
    const left = Math.ceil(clip.text.length * clamp01((clip.duration - local) / typeD));
    chars = chars === null ? left : Math.min(chars, left);
  } else apply(clip.animOut, (clip.duration - local) / d, -1);
  return { alpha, dy, scale, chars };
}

export function drawText(ctx: Ctx2D, clip: TextClip, pose: Pose, W: number, H: number, local: number, alpha = 1) {
  const anim = textAnimation(clip, local);
  const a = pose.opacity * alpha * anim.alpha;
  if (a <= 0 || anim.chars === 0) return;
  const scale = pose.scale * anim.scale;
  const { px, lines, widths, lineH, width, pad, height } = textLayout(ctx, clip, H, scale);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.translate(pose.x * W, (pose.y + anim.dy) * H);
  if (pose.rotation) ctx.rotate((pose.rotation * Math.PI) / 180);
  ctx.font = textFont(clip, H, scale);
  ctx.textAlign = clip.align;
  ctx.textBaseline = "middle";
  const top = -height / 2;
  if (clip.background) {
    ctx.fillStyle = clip.background;
    if (clip.align === "center") ctx.fillRect(-width / 2 - pad, top - pad * 0.6, width + pad * 2, height + pad * 1.2);
    else {
      // One box per line hugs ragged left/right text.
      lines.forEach((_, i) => {
        const w = widths[i];
        const x = clip.align === "left" ? -width / 2 : width / 2 - w;
        ctx.fillRect(x - pad, top + i * lineH - pad * 0.3, w + pad * 2, lineH + pad * 0.6);
      });
    }
  }
  const x = clip.align === "left" ? -width / 2 : clip.align === "right" ? width / 2 : 0;
  // Shadow blur and offset ignore the canvas transform, so scale them by hand.
  const m = ctx.getTransform();
  const unit = Math.hypot(m.a, m.b);
  if (clip.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = px * 0.18 * unit;
    ctx.shadowOffsetY = px * 0.06 * unit;
  }
  let remaining = anim.chars ?? Number.POSITIVE_INFINITY;
  lines.forEach((full, i) => {
    const line = full.slice(0, Math.max(0, remaining));
    remaining -= full.length + 1;
    if (!line) return;
    const y = top + lineH * (i + 0.5);
    if (clip.outline) {
      ctx.strokeStyle = clip.outline;
      ctx.lineWidth = px * 0.14;
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, y);
      // The fill draws over the stroke; only one of them should cast a shadow.
      ctx.shadowColor = "transparent";
    }
    ctx.fillStyle = clip.color;
    ctx.fillText(line, x, y);
  });
  ctx.restore();
}

export interface FrameSources {
  /** The frame a media clip shows at `sourceTime`, or null when it isn't ready. */
  visual(clip: MediaClip, sourceTime: number): Drawable | null;
}

/** Draw the whole frame at timeline time `t`. Preview and export both come through here. */
export function renderFrame(
  ctx: Ctx2D,
  p: Project,
  t: number,
  sources: FrameSources,
  edges = transitionMap(p),
  scratch?: Scratch,
) {
  const W = p.width;
  const H = p.height;
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);
  for (const track of drawOrder(p)) {
    for (const clip of trackClips(p, track.id)) {
      const e = edges.get(clip.id);
      const [from, to] = visualWindow(clip, e);
      if (t < from || t >= to) continue;
      const local = t - clip.start;
      const pose = poseAt(clip, Math.min(Math.max(local, 0), clip.duration));
      if (clip.type === "text") {
        drawText(ctx, clip, pose, W, H, local);
        continue;
      }
      const src = sources.visual(clip, sourceTime(clip, t));
      if (!src) continue;
      const alpha = pose.opacity * fadeGain(clip, local) * transitionAlpha(clip, e, t);
      drawMedia(ctx, clip, pose, src, W, H, alpha, scratch);
    }
  }
}

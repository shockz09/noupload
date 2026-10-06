// Audio for the video editor: the export mix, ducking, loudness and the mono
// mix captions are transcribed from.
//
// Everything is rendered through an OfflineAudioContext. Clips at a speed other
// than 1 are WSOLA time-stretched first so voices keep their pitch, matching
// what the preview's media elements do with preservesPitch.

import { timeStretchPlanes } from "../../audio/time-stretch";
import { getMediaAudio } from "./media";
import {
  audioFades,
  type Clip,
  clipEnd,
  DUCK_LEVEL,
  type MediaClip,
  type MediaItem,
  type Project,
  transitionMap,
} from "./model";

/** Ducking envelope resolution, values per second. */
export const DUCK_RATE = 20;
const DUCK_THRESHOLD = 0.012; // ≈ -38 dBFS RMS counts as "something is playing"
const DUCK_ATTACK = 0.15;
const DUCK_RELEASE = 0.5;

export function isAudible(p: Project, clip: Clip, media: Map<string, MediaItem>): clip is MediaClip {
  if (clip.type !== "media" || clip.volume <= 0) return false;
  const track = p.tracks.find((t) => t.id === clip.trackId);
  const item = media.get(clip.mediaId);
  return !!track && !track.muted && !!item && item.hasAudio;
}

// Stretched segments are expensive and the same clip mixes again on every
// export and every ducking pass, so they are kept for the session.
const stretchCache = new Map<string, Promise<AudioBuffer>>();

function stretched(buffer: AudioBuffer, key: string, from: number, length: number, speed: number) {
  const k = `${key}|${from.toFixed(4)}|${length.toFixed(4)}|${speed}`;
  let p = stretchCache.get(k);
  if (!p) {
    p = (async () => {
      const rate = buffer.sampleRate;
      const a = Math.max(0, Math.floor(from * rate));
      const b = Math.min(buffer.length, Math.ceil((from + length) * rate));
      const planes = Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch).slice(a, b));
      const out = await timeStretchPlanes(planes, speed);
      const result = new AudioBuffer({
        numberOfChannels: out.length,
        length: Math.max(1, out[0].length),
        sampleRate: rate,
      });
      out.forEach((plane, ch) => result.copyToChannel(plane as Float32Array<ArrayBuffer>, ch));
      return result;
    })();
    stretchCache.set(k, p);
    if (stretchCache.size > 24) stretchCache.delete(stretchCache.keys().next().value!);
  }
  return p;
}

interface MixOptions {
  sampleRate: number;
  channels: number;
  /** Only mix clips this accepts. */
  only?: (clip: MediaClip) => boolean;
  /** Ducking envelope at DUCK_RATE, applied to clips with `duck` set. */
  duck?: Float32Array | null;
}

async function render(p: Project, media: Map<string, MediaItem>, duration: number, opts: MixOptions) {
  const clips = p.clips.filter((c): c is MediaClip => isAudible(p, c, media) && (!opts.only || opts.only(c)));
  if (clips.length === 0) return null;
  const edges = transitionMap(p);
  const ctx = new OfflineAudioContext(
    opts.channels,
    Math.max(1, Math.ceil(duration * opts.sampleRate)),
    opts.sampleRate,
  );
  let scheduled = 0;
  for (const clip of clips) {
    const item = media.get(clip.mediaId)!;
    const buffer = await getMediaAudio(item);
    if (!buffer || clip.in >= buffer.duration) continue;
    const src = ctx.createBufferSource();
    let offset = clip.in;
    if (Math.abs(clip.speed - 1) > 1e-3) {
      src.buffer = await stretched(buffer, item.id, clip.in, clip.duration * clip.speed, clip.speed);
      offset = 0;
    } else {
      src.buffer = buffer;
    }
    const gain = ctx.createGain();
    const end = clipEnd(clip);
    const { fadeIn, fadeOut } = audioFades(clip, edges.get(clip.id));
    const g = gain.gain;
    g.setValueAtTime(fadeIn > 0 ? 0 : clip.volume, clip.start);
    if (fadeIn > 0) g.linearRampToValueAtTime(clip.volume, clip.start + Math.min(fadeIn, clip.duration));
    if (fadeOut > 0) {
      g.setValueAtTime(clip.volume, Math.max(clip.start, end - fadeOut));
      g.linearRampToValueAtTime(0, end);
    }
    let node: AudioNode = src.connect(gain);
    if (clip.duck && opts.duck) {
      const duck = ctx.createGain();
      const a = Math.floor(clip.start * DUCK_RATE);
      const b = Math.max(a + 2, Math.ceil(end * DUCK_RATE));
      const curve = new Float32Array(b - a);
      for (let i = 0; i < curve.length; i++) curve[i] = opts.duck[Math.min(opts.duck.length - 1, a + i)] ?? 1;
      duck.gain.setValueCurveAtTime(curve, a / DUCK_RATE, curve.length / DUCK_RATE);
      node = node.connect(duck);
    }
    node.connect(ctx.destination);
    src.start(clip.start, offset, clip.duration);
    scheduled++;
  }
  return scheduled > 0 ? ctx.startRendering() : null;
}

/**
 * Gain for ducked clips over time, at DUCK_RATE: DUCK_LEVEL while any other
 * audio is playing, 1 otherwise, with a soft attack and release. Null when no
 * clip asks to be ducked.
 */
export async function duckEnvelope(
  p: Project,
  media: Map<string, MediaItem>,
  duration: number,
): Promise<Float32Array | null> {
  if (!p.clips.some((c) => c.type === "media" && c.duck && isAudible(p, c, media))) return null;
  const rate = 8000;
  const voice = await render(p, media, duration, { sampleRate: rate, channels: 1, only: (c) => !c.duck });
  const n = Math.max(1, Math.ceil(duration * DUCK_RATE));
  const env = new Float32Array(n).fill(1);
  if (!voice) return env;
  const data = voice.getChannelData(0);
  const block = rate / DUCK_RATE;
  const up = 1 - Math.exp(-1 / (DUCK_ATTACK * DUCK_RATE));
  const down = 1 - Math.exp(-1 / (DUCK_RELEASE * DUCK_RATE));
  let level = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const from = i * block;
    const to = Math.min(data.length, from + block);
    for (let j = from; j < to; j++) sum += data[j] * data[j];
    const active = to > from && Math.sqrt(sum / (to - from)) > DUCK_THRESHOLD ? 1 : 0;
    level += (active - level) * (active > level ? up : down);
    env[i] = 1 - (1 - DUCK_LEVEL) * level;
  }
  return env;
}

/** The finished stereo mix for export, or null when nothing is audible. */
export async function mixAudio(p: Project, media: Map<string, MediaItem>, duration: number, sampleRate = 48_000) {
  const duck = await duckEnvelope(p, media, duration);
  return render(p, media, duration, { sampleRate, channels: 2, duck });
}

/** Everything audible as 16 kHz mono, which is what the speech model wants. */
export async function mixForCaptions(p: Project, media: Map<string, MediaItem>, duration: number) {
  const duck = await duckEnvelope(p, media, duration);
  const buffer = await render(p, media, duration, { sampleRate: 16_000, channels: 1, duck });
  return buffer ? buffer.getChannelData(0) : null;
}

/** Loudest sample a clip plays (before its volume), 0–1. */
export async function clipPeak(clip: MediaClip, item: MediaItem): Promise<number> {
  const buffer = await getMediaAudio(item);
  if (!buffer) return 0;
  const rate = buffer.sampleRate;
  const a = Math.max(0, Math.floor(clip.in * rate));
  const b = Math.min(buffer.length, Math.ceil((clip.in + clip.duration * clip.speed) * rate));
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = a; i < b; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Look up the ducking gain at timeline time `t`. */
export function duckAt(env: Float32Array | null, t: number) {
  if (!env) return 1;
  return env[Math.min(env.length - 1, Math.max(0, Math.floor(t * DUCK_RATE)))] ?? 1;
}

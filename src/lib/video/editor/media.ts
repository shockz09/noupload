// Media import for the video editor: probe, thumbnails, peaks and decoded audio.

import { loadAudioFile } from "@/lib/audio-utils";
import { isTransportStream, remuxTransportStream } from "../transport-stream";
import { createInput } from "../utils";
import { type MediaItem, type MediaKind, uid } from "./model";

const THUMB_COUNT = 12;
const THUMB_HEIGHT = 48;
const PEAK_COUNT = 600;

export function mediaKindOf(file: File): MediaKind | null {
  const t = file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"].includes(ext)) return "image";
  if (t.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"].includes(ext)) return "audio";
  if (t.startsWith("video/") || ["mp4", "mov", "mkv", "webm", "m4v", "lrv", "ts"].includes(ext)) return "video";
  return null;
}

// Decoded audio is shared between the waveform, and export, keyed by media id.
const audioCache = new Map<string, Promise<AudioBuffer | null>>();

async function decodeVideoAudio(file: File): Promise<AudioBuffer | null> {
  const { AudioBufferSink } = await import("mediabunny");
  const input = await createInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const duration = await input.computeDuration();
    const rate = track.sampleRate;
    const channels = track.numberOfChannels;
    const out = new AudioBuffer({ numberOfChannels: channels, length: Math.max(1, Math.ceil(duration * rate)), sampleRate: rate });
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      const at = Math.max(0, Math.round(timestamp * rate));
      if (at >= out.length) break;
      for (let ch = 0; ch < channels; ch++) {
        const data = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
        out.copyToChannel(data.subarray(0, out.length - at), ch, at);
      }
    }
    return out;
  } finally {
    input[Symbol.dispose]();
  }
}

export function getMediaAudio(item: MediaItem): Promise<AudioBuffer | null> {
  let p = audioCache.get(item.id);
  if (!p) {
    p =
      item.kind === "audio"
        ? loadAudioFile(item.file)
        : item.kind === "video" && item.hasAudio
          ? decodeVideoAudio(item.file).catch(() => null)
          : Promise.resolve(null);
    audioCache.set(item.id, p);
  }
  return p;
}

export function forgetMedia(item: MediaItem) {
  audioCache.delete(item.id);
  URL.revokeObjectURL(item.url);
}

function computePeaks(buffer: AudioBuffer, count = PEAK_COUNT): number[] {
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / count));
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < count; i++) {
    let peak = 0;
    const from = i * block;
    const to = Math.min(data.length, from + block);
    for (let j = from; j < to; j += 4) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  return max > 0 ? peaks.map((p) => p / max) : peaks;
}

async function probeVideo(file: File) {
  const { CanvasSink } = await import("mediabunny");
  const input = await createInput(file);
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error(`No video track found in "${file.name}".`);
    if (!(await video.canDecode())) throw new Error(`Your browser can't decode the video in "${file.name}".`);
    const audio = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    const thumbs: string[] = [];
    const sink = new CanvasSink(video, { height: THUMB_HEIGHT });
    const times = Array.from({ length: THUMB_COUNT }, (_, i) => ((i + 0.5) / THUMB_COUNT) * duration);
    for await (const frame of sink.canvasesAtTimestamps(times)) {
      if (!frame) {
        thumbs.push("");
        continue;
      }
      const c = frame.canvas as HTMLCanvasElement;
      thumbs.push(c.toDataURL("image/jpeg", 0.6));
    }
    return {
      duration,
      width: video.displayWidth,
      height: video.displayHeight,
      hasAudio: !!audio,
      thumbs,
    };
  } finally {
    input[Symbol.dispose]();
  }
}

export async function importMedia(source: File): Promise<MediaItem> {
  // The preview plays media in <video> elements, which can't play a .ts.
  const file = isTransportStream(source) ? await remuxTransportStream(source) : source;
  const kind = mediaKindOf(file);
  if (!kind) throw new Error(`"${file.name}" isn't a video, audio or image file.`);
  const url = URL.createObjectURL(file);
  const base = { id: uid("m"), kind, file, url, name: file.name, thumbs: [] as string[], peaks: [] as number[] };

  try {
    if (kind === "image") {
      const bmp = await createImageBitmap(file);
      const item = { ...base, duration: 0, width: bmp.width, height: bmp.height, hasAudio: false, thumbs: [url] };
      bmp.close();
      return item;
    }
    if (kind === "audio") {
      const item: MediaItem = { ...base, duration: 0, width: 0, height: 0, hasAudio: true };
      const buffer = await getMediaAudio(item);
      if (!buffer) throw new Error(`Could not read audio from "${file.name}".`);
      return { ...item, duration: buffer.duration, peaks: computePeaks(buffer) };
    }
    const info = await probeVideo(file);
    return { ...base, ...info };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Fill in waveform peaks for a video's audio in the background. */
export async function loadVideoPeaks(item: MediaItem): Promise<number[]> {
  const buffer = await getMediaAudio(item);
  return buffer ? computePeaks(buffer) : [];
}

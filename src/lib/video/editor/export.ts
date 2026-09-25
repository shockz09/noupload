// Render a video editor project to MP4, WebM or MOV with Mediabunny (WebCodecs).
//
// Frames are composited on a canvas one at a time: each active video clip pulls
// its frames from a samplesAtTimestamps() pipeline, so every source packet is
// decoded at most once. Audio from every audible clip is mixed up front in an
// OfflineAudioContext (volume, fades, placement) and encoded as one track.
// Drawing happens in project coordinates; a canvas transform scales it to the
// export resolution.

import type { VideoSample } from "mediabunny";
import { createInput } from "../utils";
import { getMediaAudio } from "./media";
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
} from "./model";

type MediabunnyMod = typeof import("mediabunny");
type MBVideoCodec = Parameters<MediabunnyMod["canEncodeVideo"]>[0];

const SAMPLE_RATE = 48_000;

export type ExportFormat = "mp4" | "webm" | "mov";
export type ExportQuality = "high" | "standard" | "small";

export interface ExportSettings {
  format: ExportFormat;
  /** Short side of the output in pixels; the project's own size when it isn't smaller. */
  resolution: number;
  quality: ExportQuality;
}

const EXPORT_FORMATS: Record<ExportFormat, { mime: string; video: MBVideoCodec[]; audio: "aac" | "opus" }> = {
  mp4: { mime: "video/mp4", video: ["avc", "vp9", "hevc", "av1"], audio: "aac" },
  mov: { mime: "video/quicktime", video: ["avc", "hevc"], audio: "aac" },
  webm: { mime: "video/webm", video: ["vp9", "av1", "vp8"], audio: "opus" },
};

// Bits per pixel per frame: at "standard", 1080p30 ≈ 6 Mbps.
const QUALITY: Record<ExportQuality, { bpp: number; floor: number; audio: number }> = {
  high: { bpp: 0.16, floor: 2_500_000, audio: 256_000 },
  standard: { bpp: 0.1, floor: 1_500_000, audio: 192_000 },
  small: { bpp: 0.05, floor: 800_000, audio: 128_000 },
};

/** Output frame size for a project at the chosen resolution, never upscaled. */
export function exportSize(project: Pick<Project, "width" | "height">, resolution: number) {
  const short = Math.min(project.width, project.height);
  const scale = Math.min(1, resolution / short);
  return {
    width: Math.round(project.width * scale) & ~1,
    height: Math.round(project.height * scale) & ~1,
  };
}

export function exportBitrates(width: number, height: number, fps: number, quality: ExportQuality) {
  const q = QUALITY[quality];
  return { video: Math.round(Math.max(q.floor, width * height * fps * q.bpp)), audio: q.audio };
}

async function resolveVideoCodec(mod: MediabunnyMod, format: ExportFormat, width: number, height: number, bitrate: number) {
  const codec = await mod.getFirstEncodableVideoCodec(EXPORT_FORMATS[format].video, { width, height, bitrate });
  if (codec) return codec;
  throw new Error(
    format === "mp4"
      ? "Your browser can't encode video at this resolution. Try Chrome or Edge, or a smaller size."
      : `Your browser can't encode ${format.toUpperCase()} video at this resolution. Try MP4 or a smaller size.`,
  );
}

async function ensureAudioEncoder(mod: MediabunnyMod, codec: "aac" | "opus") {
  if (await mod.canEncodeAudio(codec)) return;
  if (codec === "opus") throw new Error("Your browser can't encode WebM audio. Try MP4 instead.");
  const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
  registerAacEncoder();
}

function isAudible(p: Project, clip: Clip, media: Map<string, MediaItem>): clip is MediaClip {
  if (clip.type !== "media" || clip.volume <= 0) return false;
  const track = p.tracks.find((t) => t.id === clip.trackId);
  const item = media.get(clip.mediaId);
  return !!track && !track.muted && !!item && item.hasAudio;
}

async function mixAudio(p: Project, media: Map<string, MediaItem>, duration: number): Promise<AudioBuffer | null> {
  const clips = p.clips.filter((c): c is MediaClip => isAudible(p, c, media));
  if (clips.length === 0) return null;

  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  let scheduled = 0;
  for (const clip of clips) {
    const buffer = await getMediaAudio(media.get(clip.mediaId)!);
    if (!buffer || clip.in >= buffer.duration) continue;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    const end = clipEnd(clip);
    const g = gain.gain;
    g.setValueAtTime(clip.fadeIn > 0 ? 0 : clip.volume, clip.start);
    if (clip.fadeIn > 0) g.linearRampToValueAtTime(clip.volume, clip.start + Math.min(clip.fadeIn, clip.duration));
    if (clip.fadeOut > 0) {
      g.setValueAtTime(clip.volume, Math.max(clip.start, end - clip.fadeOut));
      g.linearRampToValueAtTime(0, end);
    }
    src.connect(gain).connect(ctx.destination);
    src.start(clip.start, clip.in, clip.duration);
    scheduled++;
  }
  return scheduled > 0 ? ctx.startRendering() : null;
}

/** Frame pipeline for one video clip: yields the source frame for each output frame the clip covers. */
interface ClipFrames {
  clip: MediaClip;
  first: number;
  last: number;
  iterator: AsyncGenerator<VideoSample | null> | null;
  current: VideoSample | null;
  dispose: (() => void) | null;
}

export interface ExportOptions {
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  format: ExportFormat;
  width: number;
  height: number;
}

export async function exportProject(
  project: Project,
  media: Map<string, MediaItem>,
  settings: ExportSettings,
  { onProgress, signal }: ExportOptions = {},
): Promise<ExportResult> {
  const duration = projectDuration(project);
  if (duration <= 0) throw new Error("The timeline is empty. Add some clips first.");

  const mod = await import("mediabunny");
  const { Output, Mp4OutputFormat, MovOutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, AudioBufferSource, VideoSampleSink } =
    mod;

  // Everything is drawn in project coordinates (W×H) onto an outW×outH canvas.
  const W = project.width;
  const H = project.height;
  const { width: outW, height: outH } = exportSize(project, settings.resolution);
  const fps = project.fps;
  const { format } = settings;
  const bitrates = exportBitrates(outW, outH, fps, settings.quality);
  const codec = await resolveVideoCodec(mod, format, outW, outH, bitrates.video);
  const audioCodec = EXPORT_FORMATS[format].audio;

  onProgress?.(0.01);
  const mixed = await mixAudio(project, media, duration);
  if (mixed) await ensureAudioEncoder(mod, audioCodec);
  onProgress?.(0.08);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.setTransform(outW / W, 0, 0, outH / H, 0, 0);

  const container =
    format === "webm"
      ? new WebMOutputFormat()
      : format === "mov"
        ? new MovOutputFormat({ fastStart: "in-memory" })
        : new Mp4OutputFormat({ fastStart: "in-memory" });
  const output = new Output({ format: container, target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec, bitrate: bitrates.video, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = mixed ? new AudioBufferSource({ codec: audioCodec, bitrate: bitrates.audio }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const tracks = drawOrder(project);
  const visibleTrackIds = new Set(tracks.map((t) => t.id));
  const frameCount = Math.max(1, Math.ceil(duration * fps));

  // Images decode once; video clips get lazily opened frame pipelines.
  const images = new Map<string, ImageBitmap>();
  const pipelines = new Map<string, ClipFrames>();
  for (const clip of project.clips) {
    if (clip.type !== "media" || !visibleTrackIds.has(clip.trackId)) continue;
    const item = media.get(clip.mediaId);
    if (!item) continue;
    if (item.kind === "image" && !images.has(item.id)) images.set(item.id, await createImageBitmap(item.file));
    if (item.kind === "video") {
      const first = Math.ceil(clip.start * fps - 1e-6);
      const last = Math.ceil(clipEnd(clip) * fps - 1e-6) - 1;
      if (last >= first) pipelines.set(clip.id, { clip, first, last, iterator: null, current: null, dispose: null });
    }
  }

  const open = async (pf: ClipFrames) => {
    const input = await createInput(media.get(pf.clip.mediaId)!.file);
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input[Symbol.dispose]();
      return;
    }
    const { clip } = pf;
    const times = function* () {
      for (let i = pf.first; i <= pf.last; i++) yield clip.in + (i / fps - clip.start);
    };
    pf.iterator = new VideoSampleSink(track).samplesAtTimestamps(times());
    pf.dispose = () => input[Symbol.dispose]();
  };

  const close = async (pf: ClipFrames) => {
    pf.current?.close();
    pf.current = null;
    await pf.iterator?.return(undefined);
    pf.dispose?.();
    pf.iterator = null;
    pf.dispose = null;
  };

  try {
    for (let i = 0; i < frameCount; i++) {
      if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      const t = i / fps;

      ctx.globalAlpha = 1;
      ctx.fillStyle = project.background;
      ctx.fillRect(0, 0, W, H);

      for (const track of tracks) {
        for (const clip of project.clips) {
          if (clip.trackId !== track.id || t < clip.start || t >= clipEnd(clip)) continue;
          if (clip.type === "text") {
            drawText(ctx, clip, W, H);
            continue;
          }
          const item = media.get(clip.mediaId);
          if (!item) continue;
          const alpha = clip.opacity * fadeGain(clip, t - clip.start);
          if (item.kind === "image") {
            const bmp = images.get(item.id)!;
            const r = placement(clip, bmp.width, bmp.height, W, H);
            ctx.globalAlpha = alpha;
            ctx.drawImage(bmp, r.dx, r.dy, r.dw, r.dh);
            ctx.globalAlpha = 1;
            continue;
          }
          const pf = pipelines.get(clip.id);
          if (!pf || i < pf.first || i > pf.last) continue;
          if (!pf.iterator) await open(pf);
          const next = pf.iterator ? await pf.iterator.next() : null;
          if (next && !next.done && next.value) {
            pf.current?.close();
            pf.current = next.value;
          }
          if (pf.current) {
            const s = pf.current;
            const r = placement(clip, s.displayWidth, s.displayHeight, W, H);
            ctx.globalAlpha = alpha;
            s.draw(ctx, r.dx, r.dy, r.dw, r.dh);
            ctx.globalAlpha = 1;
          }
          if (i === pf.last) await close(pf);
        }
      }

      await videoSource.add(t, 1 / fps);
      if (i % 5 === 0) onProgress?.(0.08 + (i / frameCount) * 0.87);
    }

    videoSource.close();
    if (audioSource && mixed) {
      await audioSource.add(mixed);
      audioSource.close();
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    for (const pf of pipelines.values()) await close(pf).catch(() => {});
    for (const bmp of images.values()) bmp.close();
  }

  onProgress?.(1);
  const blob = new Blob([output.target.buffer!], { type: EXPORT_FORMATS[format].mime });
  return { blob, format, width: outW, height: outH };
}

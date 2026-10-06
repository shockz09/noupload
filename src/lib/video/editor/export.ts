// Render a video editor project to MP4, WebM or MOV with Mediabunny (WebCodecs).
//
// Frames are composited by the same renderFrame() the preview uses: each active
// video clip pulls its frames from a samplesAtTimestamps() pipeline, so every
// source packet is decoded at most once. Audio from every audible clip is mixed
// up front (speed, volume, fades, transitions, ducking) and encoded as one
// track. Drawing happens in project coordinates; a canvas transform scales it
// to the export resolution.

import type { VideoSample } from "mediabunny";
import { createInput } from "../utils";
import { mixAudio } from "./audio";
import {
  type Drawable,
  type MediaClip,
  type MediaItem,
  type Project,
  createScratch,
  drawOrder,
  imageDrawable,
  projectDuration,
  projectFonts,
  renderFrame,
  sourceTime,
  transitionMap,
  visualWindow,
} from "./model";

type MediabunnyMod = typeof import("mediabunny");
type MBVideoCodec = Parameters<MediabunnyMod["canEncodeVideo"]>[0];

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

/** Frame pipeline for one video clip: yields the source frame for each output frame the clip covers. */
interface ClipFrames {
  clip: MediaClip;
  item: MediaItem;
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
  const edges = transitionMap(project);
  const scratch = createScratch();
  await Promise.all(projectFonts(project).map((f) => document.fonts?.load(f).catch(() => {})));

  // Images decode once; video clips get lazily opened frame pipelines covering
  // every frame they are on screen, transition overlaps included.
  const images = new Map<string, Drawable & { bitmap: ImageBitmap }>();
  const pipelines = new Map<string, ClipFrames>();
  for (const clip of project.clips) {
    if (clip.type !== "media" || !visibleTrackIds.has(clip.trackId)) continue;
    const item = media.get(clip.mediaId);
    if (!item) continue;
    if (item.kind === "image" && !images.has(item.id)) {
      const bitmap = await createImageBitmap(item.file);
      images.set(item.id, { ...imageDrawable(bitmap, bitmap.width, bitmap.height), bitmap });
    }
    if (item.kind === "video") {
      const [from, to] = visualWindow(clip, edges.get(clip.id));
      const first = Math.max(0, Math.ceil(from * fps - 1e-6));
      const last = Math.min(frameCount - 1, Math.ceil(to * fps - 1e-6) - 1);
      if (last >= first) pipelines.set(clip.id, { clip, item, first, last, iterator: null, current: null, dispose: null });
    }
  }
  const ordered = [...pipelines.values()];

  const open = async (pf: ClipFrames) => {
    const input = await createInput(pf.item.file);
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input[Symbol.dispose]();
      return;
    }
    const { clip } = pf;
    // Beyond either end of the source (a transition's overlap), hold the edge frame.
    const lastFrame = Math.max(0, pf.item.duration - 0.5 / fps);
    const times = function* () {
      for (let i = pf.first; i <= pf.last; i++) yield Math.min(lastFrame, Math.max(0, sourceTime(clip, i / fps)));
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

  const sampleDrawable = (s: VideoSample): Drawable => ({
    width: s.displayWidth,
    height: s.displayHeight,
    draw: (c, sx, sy, sw, sh, dx, dy, dw, dh) => s.draw(c, sx, sy, sw, sh, dx, dy, dw, dh),
  });

  const sources = {
    visual(clip: MediaClip): Drawable | null {
      const item = media.get(clip.mediaId);
      if (!item) return null;
      if (item.kind === "image") return images.get(item.id) ?? null;
      const s = pipelines.get(clip.id)?.current;
      return s ? sampleDrawable(s) : null;
    },
  };

  try {
    for (let i = 0; i < frameCount; i++) {
      if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      const t = i / fps;

      for (const pf of ordered) {
        if (i < pf.first || i > pf.last) continue;
        if (!pf.iterator) await open(pf);
        const next = pf.iterator ? await pf.iterator.next() : null;
        if (next && !next.done && next.value) {
          pf.current?.close();
          pf.current = next.value;
        }
      }

      renderFrame(ctx, project, t, sources, edges, scratch);

      for (const pf of ordered) if (i === pf.last) await close(pf);

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
    for (const img of images.values()) img.bitmap.close();
  }

  onProgress?.(1);
  const blob = new Blob([output.target.buffer!], { type: EXPORT_FORMATS[format].mime });
  return { blob, format, width: outW, height: outH };
}

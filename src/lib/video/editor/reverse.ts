// Play a stretch of video backwards, as a new MP4 the editor can use like any
// other media.
//
// Decoders only run forwards, so the range is walked in short chunks from its
// end: each chunk is decoded front to back, held as frames, then encoded back
// to front. Only one chunk of frames is alive at a time, which keeps memory
// flat however long the range is. Audio is decoded once and reversed sample by
// sample.

import type { VideoSample } from "mediabunny";
import { createInput } from "../utils";
import { getMediaAudio } from "./media";
import type { MediaItem } from "./model";

const CHUNK = 0.5;
const MAX_EDGE = 1920;

export interface ReverseOptions {
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export async function reverseRange(
  item: MediaItem,
  from: number,
  to: number,
  { onProgress, signal }: ReverseOptions = {},
) {
  const mod = await import("mediabunny");
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, VideoSampleSink, QUALITY_HIGH } = mod;
  const input = await createInput(item.file);
  const held: VideoSample[] = [];
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This clip has no video to reverse.");
    const stats = await track.computePacketStats(120).catch(() => null);
    const fps = Math.min(60, Math.max(1, Math.round(stats?.averagePacketRate || 30)));
    const k = Math.min(1, MAX_EDGE / Math.max(track.displayWidth, track.displayHeight));
    const width = Math.max(2, Math.round((track.displayWidth * k) / 2) * 2);
    const height = Math.max(2, Math.round((track.displayHeight * k) / 2) * 2);

    const codec = await mod.getFirstEncodableVideoCodec(["avc", "vp9", "av1", "hevc"], { width, height });
    if (!codec) throw new Error("Your browser can't encode video, so it can't reverse clips.");

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const video = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 1 });
    output.addVideoTrack(video, { frameRate: fps });

    let audio: InstanceType<typeof AudioBufferSource> | null = null;
    let reversedAudio: AudioBuffer | null = null;
    const buffer = item.hasAudio ? await getMediaAudio(item) : null;
    if (buffer) {
      const rate = buffer.sampleRate;
      const a = Math.max(0, Math.floor(from * rate));
      const b = Math.min(buffer.length, Math.ceil(to * rate));
      if (b > a) {
        reversedAudio = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length: b - a, sampleRate: rate });
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          reversedAudio.copyToChannel(buffer.getChannelData(ch).slice(a, b).reverse(), ch);
        }
        if (!(await mod.canEncodeAudio("aac"))) {
          const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
          registerAacEncoder();
        }
        audio = new AudioBufferSource({ codec: "aac", bitrate: 192_000 });
        output.addAudioTrack(audio);
      }
    }
    await output.start();

    const sink = new VideoSampleSink(track);
    const total = to - from;
    let frame = 0;
    try {
      for (let end = to; end > from + 1e-6; end -= CHUNK) {
        const start = Math.max(from, end - CHUNK);
        const first = start <= from + 1e-6;
        for await (const s of sink.samples(start, end)) {
          if (signal?.aborted) {
            s.close();
            throw new DOMException("Reverse cancelled", "AbortError");
          }
          // The frame on screen at `start` belongs to the earlier chunk, unless there is none.
          if (!first && s.timestamp < start - 1e-4) s.close();
          else held.push(s);
        }
        while (held.length) {
          const s = held.pop()!;
          s.draw(ctx, 0, 0, width, height);
          s.close();
          await video.add(frame / fps, 1 / fps);
          frame++;
        }
        onProgress?.(Math.min(0.95, (to - start) / total));
      }
      video.close();
      if (audio && reversedAudio) {
        await audio.add(reversedAudio);
        audio.close();
      }
      await output.finalize();
    } catch (err) {
      await output.cancel().catch(() => {});
      throw err;
    }
    onProgress?.(1);
    const base = item.name.replace(/\.[^.]+$/, "");
    return new File([output.target.buffer!], `${base}-reversed.mp4`, { type: "video/mp4" });
  } finally {
    for (const s of held) s.close();
    input[Symbol.dispose]();
  }
}

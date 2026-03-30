// Video compression using Mediabunny (WebCodecs)

import { createInput, getBaseName } from "./utils";

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  totalBitrate: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
}

export async function analyzeVideo(file: File): Promise<VideoInfo> {
  const input = await createInput(file);

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const videoStats = videoTrack ? await videoTrack.computePacketStats() : null;
    const audioStats = audioTrack ? await audioTrack.computePacketStats() : null;
    const duration = await input.computeDuration();

    return {
      duration,
      width: videoTrack?.displayWidth ?? 0,
      height: videoTrack?.displayHeight ?? 0,
      videoBitrate: videoStats?.averageBitrate ?? 0,
      audioBitrate: audioStats?.averageBitrate ?? 0,
      totalBitrate: (videoStats?.averageBitrate ?? 0) + (audioStats?.averageBitrate ?? 0),
      fps: videoStats?.averagePacketRate ?? 0,
      videoCodec: videoTrack?.codec ?? "unknown",
      audioCodec: audioTrack?.codec ?? "unknown",
    };
  } finally {
    input[Symbol.dispose]();
  }
}

export type VideoCodec = "avc" | "hevc";
export type Resolution = "original" | "1080p" | "720p" | "480p";

export interface CompressOptions {
  videoBitrate: number;
  audioBitrate: number;
  codec: VideoCodec;
  resolution: Resolution;
  frameRate: number | null;
}

const RESOLUTION_HEIGHTS: Record<Resolution, number | null> = {
  original: null,
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
};

export interface CompressResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

export async function compressVideo(
  file: File,
  options: CompressOptions,
  onProgress?: (progress: number) => void,
): Promise<CompressResult> {
  const mod = await import("mediabunny");
  const { Output, Conversion, Mp4OutputFormat, BufferTarget } = mod;

  if (!(await mod.canEncodeAudio("aac"))) {
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
  }

  const input = await createInput(file);

  try {
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });

    const videoOpts: Record<string, unknown> = {
      codec: options.codec,
      bitrate: options.videoBitrate,
    };

    const targetHeight = RESOLUTION_HEIGHTS[options.resolution];
    if (targetHeight) videoOpts.height = targetHeight;
    if (options.frameRate) videoOpts.frameRate = options.frameRate;

    const conversion = await Conversion.init({
      input,
      output,
      video: videoOpts,
      audio: { codec: "aac", bitrate: options.audioBitrate },
    });

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });

    return {
      blob,
      filename: `${getBaseName(file.name)}_compressed.mp4`,
      originalSize: file.size,
      compressedSize: blob.size,
    };
  } finally {
    input[Symbol.dispose]();
  }
}

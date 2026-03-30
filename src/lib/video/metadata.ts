import { createInput } from "./utils";

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  format: string;
  mimeType: string;
  rotation: number;
  numberOfChannels: number;
  sampleRate: number;
}

export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  const input = await createInput(file);

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const videoStats = videoTrack ? await videoTrack.computePacketStats() : null;
    const audioStats = audioTrack ? await audioTrack.computePacketStats() : null;
    const duration = await input.computeDuration();
    const format = await input.getFormat();
    const mimeType = await input.getMimeType();

    return {
      duration,
      width: videoTrack?.displayWidth ?? 0,
      height: videoTrack?.displayHeight ?? 0,
      videoBitrate: videoStats?.averageBitrate ?? 0,
      audioBitrate: audioStats?.averageBitrate ?? 0,
      fps: videoStats?.averagePacketRate ?? 0,
      videoCodec: videoTrack?.codec ?? "none",
      audioCodec: audioTrack?.codec ?? "none",
      format: format?.name ?? "unknown",
      mimeType: mimeType ?? "unknown",
      rotation: videoTrack?.rotation ?? 0,
      numberOfChannels: audioTrack?.numberOfChannels ?? 0,
      sampleRate: audioTrack?.sampleRate ?? 0,
    };
  } finally {
    input[Symbol.dispose]();
  }
}

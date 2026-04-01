import { loadAudioFile } from "@/lib/audio-utils";
import { getFileBaseName } from "@/lib/utils";
import { registerAudioEncoders } from "./utils";

/**
 * Trim audio to AAC/M4A using:
 *   Web Audio API (decode + slice) → AudioBufferSource (encode to AAC) → Mp4 muxer
 */
export async function trimAudio(
  file: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  await registerAudioEncoders(["aac"]);

  const { Output, AudioBufferSource, BufferTarget, Mp4OutputFormat } = await import("mediabunny");

  onProgress?.(0.1);
  const fullBuffer = await loadAudioFile(file);

  // Slice the AudioBuffer to the trim region
  const sampleRate = fullBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.min(Math.floor(endTime * sampleRate), fullBuffer.length);
  const newLength = endSample - startSample;

  const ctx = new OfflineAudioContext(fullBuffer.numberOfChannels, newLength, sampleRate);
  const trimmedBuffer = ctx.createBuffer(fullBuffer.numberOfChannels, newLength, sampleRate);
  for (let ch = 0; ch < fullBuffer.numberOfChannels; ch++) {
    const src = fullBuffer.getChannelData(ch);
    const dst = trimmedBuffer.getChannelData(ch);
    dst.set(src.subarray(startSample, endSample));
  }

  onProgress?.(0.3);
  const source = new AudioBufferSource({ codec: "aac", bitrate: 192_000 });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  output.addAudioTrack(source);

  await source.add(trimmedBuffer);
  await output.finalize();

  onProgress?.(1);

  const blob = new Blob([output.target.buffer!], { type: "audio/mp4" });
  return { blob, filename: `${getFileBaseName(file.name)}_trimmed.m4a` };
}

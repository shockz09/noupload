import { loadAudioFile } from "@/lib/audio-utils";
import { getFileBaseName } from "@/lib/utils";
import { registerAudioEncoders } from "./utils";

export interface CompressAudioResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * Compress audio to AAC/M4A using:
 *   Web Audio API (decode any format) → AudioBufferSource (encode to AAC) → Mp4 muxer
 *
 * Some browsers reject certain AAC bitrate/channel combos (e.g. Safari + 64kbps stereo).
 * We try the requested bitrate first, then fall back to the next supported one.
 */
export async function compressAudio(
  file: File,
  bitrate: number,
  onProgress?: (progress: number) => void,
): Promise<CompressAudioResult> {
  await registerAudioEncoders(["aac"]);

  const { Output, AudioBufferSource, BufferTarget, Mp4OutputFormat } = await import("mediabunny");

  onProgress?.(0.1);
  const audioBuffer = await loadAudioFile(file);
  onProgress?.(0.3);

  // Deduplicated, ascending from requested bitrate
  const candidates = [...new Set([bitrate, 96_000, 128_000, 192_000])].filter((b) => b >= bitrate);

  let lastError: unknown;
  for (const br of candidates) {
    try {
      const source = new AudioBufferSource({ codec: "aac", bitrate: br });
      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: "in-memory" }),
        target: new BufferTarget(),
      });
      output.addAudioTrack(source);
      await output.start();
      await source.add(audioBuffer);
      await output.finalize();

      onProgress?.(1);

      const blob = new Blob([output.target.buffer!], { type: "audio/mp4" });
      return {
        blob,
        filename: `${getFileBaseName(file.name)}_compressed.m4a`,
        originalSize: file.size,
        compressedSize: blob.size,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

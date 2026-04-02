import { audioBufferToWav, loadAudioFile } from "@/lib/audio-utils";
import { getFileBaseName } from "@/lib/utils";
import { registerAudioEncoders } from "./utils";

export type AudioOutputFormat = "mp3" | "wav" | "ogg" | "flac" | "aac";

interface FormatConfig {
  ext: string;
  mimeType: string;
  codec?: string;
  encoder?: "aac" | "mp3";
}

const FORMAT_CONFIGS: Record<AudioOutputFormat, FormatConfig> = {
  mp3: { ext: "mp3", mimeType: "audio/mpeg", codec: "mp3", encoder: "mp3" },
  wav: { ext: "wav", mimeType: "audio/wav" },
  ogg: { ext: "ogg", mimeType: "audio/ogg", codec: "opus" },
  flac: { ext: "flac", mimeType: "audio/flac", codec: "flac" },
  aac: { ext: "m4a", mimeType: "audio/mp4", codec: "aac", encoder: "aac" },
};

function createOutputFormat(format: AudioOutputFormat, mod: typeof import("mediabunny")) {
  switch (format) {
    case "ogg": return new mod.OggOutputFormat();
    case "mp3": return new mod.Mp3OutputFormat();
    case "flac": return new mod.FlacOutputFormat();
    default: return new mod.Mp4OutputFormat({ fastStart: "in-memory" });
  }
}

/**
 * Convert audio using:
 *   Web Audio API (decode any format) → encode to target
 *
 * WAV/FLAC: pure Web Audio API (no mediabunny needed for WAV, FLAC uses PCM codec)
 * MP3/AAC: Web Audio API decode → AudioBufferSource encode → muxer
 * OGG/Opus: Same, but relies on native WebCodecs Opus support (Chrome only)
 */
export async function convertAudio(
  file: File,
  format: AudioOutputFormat,
  bitrate: number,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const config = FORMAT_CONFIGS[format];
  const baseName = getFileBaseName(file.name);

  onProgress?.(0.1);
  const audioBuffer = await loadAudioFile(file);

  // WAV: direct conversion, no mediabunny needed
  if (format === "wav") {
    onProgress?.(0.5);
    const blob = audioBufferToWav(audioBuffer);
    onProgress?.(1);
    return { blob, filename: `${baseName}.wav` };
  }

  // For encoded formats, use mediabunny's AudioBufferSource
  if (config.encoder) {
    await registerAudioEncoders([config.encoder]);
  }

  const mod = await import("mediabunny");

  // Check if encoding is actually supported before proceeding
  if (config.codec && !(await mod.canEncodeAudio(config.codec as Parameters<typeof mod.canEncodeAudio>[0]))) {
    throw new Error(`${format.toUpperCase()} encoding is not supported by your browser.`);
  }

  onProgress?.(0.3);
  const { Output, AudioBufferSource, BufferTarget } = mod;

  const isLossless = format === "flac";
  const codec = config.codec as "mp3" | "aac" | "opus" | "flac";
  const source = new AudioBufferSource({
    codec,
    ...(!isLossless ? { bitrate } : {}),
  });
  const output = new Output({
    format: createOutputFormat(format, mod),
    target: new BufferTarget(),
  });
  output.addAudioTrack(source);
  await output.start();

  await source.add(audioBuffer);
  await output.finalize();

  onProgress?.(1);

  const blob = new Blob([output.target.buffer!], { type: config.mimeType });
  return { blob, filename: `${baseName}.${config.ext}` };
}

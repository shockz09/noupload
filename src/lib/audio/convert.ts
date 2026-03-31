import { getFileBaseName } from "@/lib/utils";
import { createAudioInput, registerAudioEncoders } from "./utils";

export type AudioOutputFormat = "mp3" | "wav" | "ogg" | "flac" | "aac";

type AudioCodec = "mp3" | "aac" | "opus" | "flac";

interface FormatConfig {
  ext: string;
  mimeType: string;
  codec?: AudioCodec;
  encoder?: "aac" | "mp3";
}

const FORMAT_CONFIGS: Record<AudioOutputFormat, FormatConfig> = {
  mp3: { ext: "mp3", mimeType: "audio/mpeg", codec: "mp3", encoder: "mp3" },
  wav: { ext: "wav", mimeType: "audio/wav" },
  ogg: { ext: "ogg", mimeType: "audio/ogg", codec: "opus" },
  flac: { ext: "flac", mimeType: "audio/flac", codec: "flac" },
  aac: { ext: "m4a", mimeType: "audio/mp4", codec: "aac", encoder: "aac" },
};

export async function convertAudio(
  file: File,
  format: AudioOutputFormat,
  bitrate: number,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const config = FORMAT_CONFIGS[format];

  if (config.encoder) {
    await registerAudioEncoders([config.encoder]);
  }

  const mod = await import("mediabunny");
  const { Output, Conversion, BufferTarget } = mod;

  const input = await createAudioInput(file);

  try {
    const outputFormat =
      format === "wav"
        ? new mod.WavOutputFormat()
        : format === "ogg"
          ? new mod.OggOutputFormat()
          : format === "mp3"
            ? new mod.Mp3OutputFormat()
            : format === "flac"
              ? new mod.FlacOutputFormat()
              : new mod.Mp4OutputFormat({ fastStart: "in-memory" });

    const output = new Output({ format: outputFormat, target: new BufferTarget() });

    const isLossless = format === "wav" || format === "flac";

    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      ...(config.codec
        ? { audio: { codec: config.codec, ...(!isLossless ? { bitrate } : {}) } }
        : {}),
    });

    if (!conversion.isValid) {
      throw new Error("Cannot convert this file. The format may not be supported by your browser.");
    }

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: config.mimeType });
    return { blob, filename: `${getFileBaseName(file.name)}.${config.ext}` };
  } finally {
    input[Symbol.dispose]();
  }
}

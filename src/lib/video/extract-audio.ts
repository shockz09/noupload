import { createInput, getBaseName } from "./utils";

export type AudioOutputFormat = "mp3" | "wav" | "aac" | "ogg";

type AudioCodec = "mp3" | "aac" | "opus";

interface FormatConfig {
  ext: string;
  mimeType: string;
  codec?: AudioCodec;
}

const FORMAT_CONFIGS: Record<AudioOutputFormat, FormatConfig> = {
  mp3: { ext: "mp3", mimeType: "audio/mpeg", codec: "mp3" },
  wav: { ext: "wav", mimeType: "audio/wav" },
  aac: { ext: "m4a", mimeType: "audio/mp4", codec: "aac" },
  ogg: { ext: "ogg", mimeType: "audio/ogg", codec: "opus" },
};

export async function extractAudio(
  file: File,
  format: AudioOutputFormat,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const mod = await import("mediabunny");
  const { Output, Conversion, BufferTarget } = mod;

  // Register fallback encoders if browser lacks native support
  if (format === "mp3" && !(await mod.canEncodeAudio("mp3"))) {
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
  }
  if (format === "aac" && !(await mod.canEncodeAudio("aac"))) {
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
  }

  const input = await createInput(file);
  const config = FORMAT_CONFIGS[format];

  try {
    const outputFormat =
      format === "wav"
        ? new mod.WavOutputFormat()
        : format === "ogg"
          ? new mod.OggOutputFormat()
          : format === "mp3"
            ? new mod.Mp3OutputFormat()
            : new mod.Mp4OutputFormat({ fastStart: "in-memory" });

    const output = new Output({ format: outputFormat, target: new BufferTarget() });

    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      ...(config.codec ? { audio: { codec: config.codec } } : {}),
    });

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: config.mimeType });
    return { blob, filename: `${getBaseName(file.name)}.${config.ext}` };
  } finally {
    input[Symbol.dispose]();
  }
}

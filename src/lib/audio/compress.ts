import { getFileBaseName } from "@/lib/utils";
import { createAudioInput, registerAudioEncoders } from "./utils";

export interface CompressAudioResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

export async function compressAudio(
  file: File,
  bitrate: number,
  onProgress?: (progress: number) => void,
): Promise<CompressAudioResult> {
  await registerAudioEncoders(["aac"]);

  const { Output, Conversion, BufferTarget, Mp4OutputFormat } = await import("mediabunny");

  const input = await createAudioInput(file);

  try {
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });

    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: { codec: "aac", bitrate },
    });

    if (!conversion.isValid) {
      throw new Error("Cannot compress this audio file. The format may not be supported by your browser.");
    }

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: "audio/mp4" });

    return {
      blob,
      filename: `${getFileBaseName(file.name)}_compressed.m4a`,
      originalSize: file.size,
      compressedSize: blob.size,
    };
  } finally {
    input[Symbol.dispose]();
  }
}

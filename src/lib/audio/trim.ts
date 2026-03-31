import { getFileBaseName } from "@/lib/utils";
import { createAudioInput, registerAudioEncoders } from "./utils";

export async function trimAudio(
  file: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
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
      trim: { start: startTime, end: endTime },
    });

    if (!conversion.isValid) {
      throw new Error("Cannot trim this file. The format may not be supported by your browser.");
    }

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: "audio/mp4" });
    return { blob, filename: `${getFileBaseName(file.name)}_trimmed.m4a` };
  } finally {
    input[Symbol.dispose]();
  }
}

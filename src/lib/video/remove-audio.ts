import { createInput, getBaseName } from "./utils";

export async function removeAudio(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const { Output, Conversion, Mp4OutputFormat, BufferTarget } = await import("mediabunny");

  const input = await createInput(file);

  try {
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });

    const conversion = await Conversion.init({
      input,
      output,
      audio: { discard: true },
    });

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
    return { blob, filename: `${getBaseName(file.name)}_silent.mp4` };
  } finally {
    input[Symbol.dispose]();
  }
}

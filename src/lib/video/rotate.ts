import { createInput, getBaseName } from "./utils";

export type RotationAngle = 90 | 180 | 270;

export async function rotateVideo(
  file: File,
  angle: RotationAngle,
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
      video: { rotate: angle },
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error("Cannot rotate — your browser doesn't support video encoding. Try Chrome or Edge.");
    }

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
    return { blob, filename: `${getBaseName(file.name)}_rotated${angle}.mp4` };
  } finally {
    input[Symbol.dispose]();
  }
}

import { createInput, getBaseName } from "./utils";

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export async function cropVideo(
  file: File,
  crop: CropRegion,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const { Output, Conversion, Mp4OutputFormat, BufferTarget } = await import("mediabunny");

  const input = await createInput(file);
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: { crop },
  });

  if (onProgress) conversion.onProgress = onProgress;
  await conversion.execute();

  const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
  input[Symbol.dispose]();

  return { blob, filename: `${getBaseName(file.name)}_cropped.mp4` };
}

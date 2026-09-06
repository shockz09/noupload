import { assertAudioDecodable, assertAudioNotDiscarded, audioOptionsFor } from "./audio-support";
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

  try {
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });

    await assertAudioDecodable(input);

    const conversion = await Conversion.init({
      input,
      output,
      video: { crop },
      audio: await audioOptionsFor(input),
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error("Cannot crop — your browser doesn't support video encoding. Try Chrome or Edge.");
    }

    assertAudioNotDiscarded(conversion);

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
    return { blob, filename: `${getBaseName(file.name)}_cropped.mp4` };
  } finally {
    input[Symbol.dispose]();
  }
}

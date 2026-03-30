import { createInput, getBaseName } from "./utils";

export type OutputFormat = "mp4" | "webm" | "mov" | "mkv";

const MIME_TYPES: Record<OutputFormat, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

export async function convertVideo(
  file: File,
  format: OutputFormat,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const { Output, Conversion, BufferTarget, Mp4OutputFormat, MovOutputFormat, MkvOutputFormat, WebMOutputFormat } =
    await import("mediabunny");

  const input = await createInput(file);

  try {
    const outputFormat =
      format === "mov"
        ? new MovOutputFormat({ fastStart: "in-memory" })
        : format === "mkv"
          ? new MkvOutputFormat()
          : format === "webm"
            ? new WebMOutputFormat()
            : new Mp4OutputFormat({ fastStart: "in-memory" });

    const output = new Output({ format: outputFormat, target: new BufferTarget() });

    const conversion = await Conversion.init(
      format === "webm"
        ? { input, output, video: { codec: "vp9" }, audio: { codec: "opus" } }
        : { input, output },
    );

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: MIME_TYPES[format] });
    return { blob, filename: `${getBaseName(file.name)}.${format}` };
  } finally {
    input[Symbol.dispose]();
  }
}

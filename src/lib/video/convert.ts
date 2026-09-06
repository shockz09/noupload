import { assertAudioDecodable, assertAudioNotDiscarded, audioOptionsFor } from "./audio-support";
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

    await assertAudioDecodable(input);

    const conversion = await Conversion.init(
      format === "webm"
        ? { input, output, video: { codec: "vp9" }, audio: { codec: "opus" }, showWarnings: false }
        : format === "mp4" || format === "mov"
          ? {
              input,
              output,
              // MOV sources often carry PCM (twos/sowt/lpcm), A-law/µ-law or AC-3 audio. MP4 can technically hold
              // some of those, so Mediabunny would copy the packets through — but no browser or QuickTime can play
              // them back, so the result sounds like the audio was dropped. audioOptionsFor transcodes anything the
              // container can't play as-is to AAC, and keeps Mediabunny off its Opus default either way.
              audio: await audioOptionsFor(input, format),
              showWarnings: false,
            }
          : { input, output, showWarnings: false },
    );

    if (!conversion.isValid) {
      throw new Error(
        `Cannot convert to ${format.toUpperCase()} — your browser doesn't support encoding the required codecs. Try Chrome or Edge.`,
      );
    }

    assertAudioNotDiscarded(conversion, format.toUpperCase());

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: MIME_TYPES[format] });
    return { blob, filename: `${getBaseName(file.name)}.${format}` };
  } finally {
    input[Symbol.dispose]();
  }
}

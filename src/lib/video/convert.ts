import { createInput, getBaseName } from "./utils";

export type OutputFormat = "mp4" | "webm" | "mov" | "mkv";

const MIME_TYPES: Record<OutputFormat, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

// Audio codecs an MP4 can hold *and* every player can actually decode.
const MP4_SAFE_AUDIO_CODECS: string[] = ["aac", "mp3"];

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
        ? { input, output, video: { codec: "vp9" }, audio: { codec: "opus" }, showWarnings: false }
        : format === "mp4"
          ? {
              input,
              output,
              // MOV sources often carry PCM (twos/sowt/lpcm), A-law/µ-law or AC-3 audio. MP4 can technically hold
              // some of those, so Mediabunny would copy the packets through — but no browser or QuickTime can play
              // them back, so the result sounds like the audio was dropped. Transcode anything that isn't a
              // universally playable MP4 audio codec to AAC.
              audio: (track) => (MP4_SAFE_AUDIO_CODECS.includes(track.codec ?? "") ? {} : { codec: "aac" }),
              showWarnings: false,
            }
          : { input, output, showWarnings: false },
    );

    if (!conversion.isValid) {
      throw new Error(
        `Cannot convert to ${format.toUpperCase()} — your browser doesn't support encoding the required codecs. Try Chrome or Edge.`,
      );
    }

    const droppedAudio = conversion.discardedTracks.find((t) => t.track.type === "audio");
    if (droppedAudio) {
      throw new Error(
        `Cannot keep the audio track (${droppedAudio.track.codec ?? "unknown codec"}) in ${format.toUpperCase()} — your browser can't decode or re-encode it. Try Chrome or Edge.`,
      );
    }

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = new Blob([output.target.buffer!], { type: MIME_TYPES[format] });
    return { blob, filename: `${getBaseName(file.name)}.${format}` };
  } finally {
    input[Symbol.dispose]();
  }
}

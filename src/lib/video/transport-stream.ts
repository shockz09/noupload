// MPEG transport streams (.ts) are rewrapped as MP4 the moment they're picked.
//
// Mediabunny can read a .ts, but the rest of the app can't live with one:
// Chrome and Firefox won't play it in a <video>, so every preview stays blank,
// and its timestamps start wherever the recorder's clock was (1.4s from ffmpeg,
// hours in for a TV capture), which skews every duration and trim point. An MP4
// remux fixes both. The packets are copied, not re-encoded, so it takes seconds
// and costs nothing in quality.

import { convertVideo } from "./convert";
import { createInput, getBaseName } from "./utils";

export function isTransportStream(file: File): boolean {
  return /\.ts$/i.test(file.name) || file.type === "video/mp2t";
}

export async function remuxTransportStream(file: File, onProgress?: (p: number) => void): Promise<File> {
  const input = await createInput(file);
  try {
    const format = await input.getFormat().catch(() => null);
    if (!format) throw new Error(`"${file.name}" isn't a video file this app can read.`);
    const video = await input.getPrimaryVideoTrack();
    // Mediabunny skips streams in codecs it doesn't know, so they show up as no
    // track at all. In a .ts that's nearly always MPEG-2, the codec of TV and
    // DVB recordings.
    if (!video?.codec) {
      throw new Error(
        `"${file.name}" has no video this app can decode. TV recordings usually use MPEG-2, which browsers can't play. Convert it to MP4 with a desktop app first.`,
      );
    }
  } finally {
    input[Symbol.dispose]();
  }

  const { blob } = await convertVideo(file, "mp4", onProgress);
  return new File([blob], `${getBaseName(file.name)}.mp4`, { type: "video/mp4", lastModified: file.lastModified });
}

import { createInput } from "./utils";

/**
 * Codecs that both live natively in an MP4 and decode in every mainstream player.
 *
 * A source in one of these can be copied across untouched when the only change is one
 * an MP4 can declare in its track header. Anything else (VP8/VP9/AV1 out of a WebM) has
 * to be re-encoded to AVC instead of copied, because an .mp4 carrying VP9 plays in
 * browsers but not in QuickTime, iOS or most editors.
 */
export const MP4_NATIVE_CODECS = ["avc", "hevc"];

/** What the orientation tools — rotate and flip — need to know before they start. */
export interface VideoTransformInfo {
  /** Display dimensions, with the rotation the file already declares applied. */
  width: number;
  height: number;
  duration: number;
  /**
   * True when the change can be written as metadata over copied packets, making it
   * instant and pixel-identical. False when the frames have to be re-encoded.
   */
  canCopy: boolean;
}

/**
 * Dimensions and duration, plus whether this file can take the fast path.
 *
 * Deliberately reads only the container's headers — no packet statistics, unlike
 * `getVideoMetadata` — so picking a file stays instant even for a multi-gigabyte video.
 */
export async function analyzeForTransform(file: File): Promise<VideoTransformInfo> {
  const input = await createInput(file);

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This file has no video track.");

    return {
      width: track.displayWidth,
      height: track.displayHeight,
      duration: await input.computeDuration(),
      canCopy: MP4_NATIVE_CODECS.includes(track.codec ?? ""),
    };
  } finally {
    input[Symbol.dispose]();
  }
}

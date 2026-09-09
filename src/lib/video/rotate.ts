import { assertAudioDecodable, assertAudioNotDiscarded, audioOptionsFor } from "./audio-support";
import { createInput, getBaseName } from "./utils";

/** Clockwise rotation to apply on top of whatever the file already declares. */
export type RotationAngle = 0 | 90 | 180 | 270;

/**
 * Codecs that both live natively in an MP4 and decode in every mainstream player.
 *
 * A source in one of these is copied across untouched — see `rotateVideo`. Anything
 * else (VP8/VP9/AV1 out of a WebM) is re-encoded to AVC instead of copied, because an
 * .mp4 carrying VP9 plays in browsers but not in QuickTime, iOS or most editors.
 */
const MP4_NATIVE_CODECS = ["avc", "hevc"];

export interface VideoRotationInfo {
  /** Display dimensions, with the rotation the file already declares applied. */
  width: number;
  height: number;
  duration: number;
  /**
   * True when rotation can be written as metadata over copied packets, making it
   * instant and pixel-identical. False when the frames have to be re-encoded.
   */
  canCopy: boolean;
}

/**
 * Dimensions and duration, plus whether this file can take the fast path.
 *
 * Deliberately reads only the container's headers — no packet statistics — so picking
 * a file stays instant even for a multi-gigabyte video.
 */
export async function analyzeForRotation(file: File): Promise<VideoRotationInfo> {
  const input = await createInput(file);

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This file has no video track to rotate.");

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

export interface RotateOptions {
  /**
   * Turn the pixels themselves instead of writing rotation metadata. Costs a full
   * re-encode, and is the only way to be upright in players that ignore the metadata.
   */
  bake?: boolean;
}

/**
 * Rotate a video clockwise by `angle`.
 *
 * An MP4 stores rotation as a transform in the track header, so for a source whose
 * codec an MP4 can hold there is nothing to re-encode: Mediabunny copies the encoded
 * packets over and writes the new angle into the header. That path is near-instant and
 * gives back the original pixels, which is why it's the default. `bake` (or a codec
 * that can't be copied) falls back to decoding and re-encoding every frame.
 *
 * `videoReEncoded` reports only the video. Audio rides along at high quality either
 * way, but Mediabunny still re-encodes it whenever the source packets start before
 * zero — AAC pre-roll, which most MP4s have — so it isn't always a straight copy.
 */
export async function rotateVideo(
  file: File,
  angle: Exclude<RotationAngle, 0>,
  options: RotateOptions = {},
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string; videoReEncoded: boolean }> {
  const { Output, Conversion, Mp4OutputFormat, BufferTarget } = await import("mediabunny");

  const input = await createInput(file);

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This file has no video track to rotate.");

    const copy = !options.bake && MP4_NATIVE_CODECS.includes(track.codec ?? "");

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });

    await assertAudioDecodable(input);

    const conversion = await Conversion.init({
      input,
      output,
      video: copy
        ? // Rotation lands in the track header; the packets are passed straight through.
          { rotate: angle }
        : // Already re-encoding, so bake the rotation in — it's the more compatible result.
          { rotate: angle, codec: "avc", allowRotationMetadata: false },
      audio: await audioOptionsFor(input),
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error("Cannot rotate — your browser doesn't support video encoding. Try Chrome or Edge.");
    }

    assertAudioNotDiscarded(conversion);

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    return {
      blob: new Blob([output.target.buffer!], { type: "video/mp4" }),
      filename: `${getBaseName(file.name)}_rotated${angle}.mp4`,
      videoReEncoded: !copy,
    };
  } finally {
    input[Symbol.dispose]();
  }
}

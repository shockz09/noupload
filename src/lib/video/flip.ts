import { assertAudioDecodable, assertAudioNotDiscarded, audioOptionsFor } from "./audio-support";
import { rotateVideo } from "./rotate";
import { createInput, getBaseName } from "./utils";

export type MirrorAxis = "horizontal" | "vertical";

/** Which way round to reflect the picture. Both at once is allowed. */
export interface Mirror {
  horizontal: boolean;
  vertical: boolean;
}

/**
 * How a given pair of mirrors is actually going to be produced.
 *
 * `half-turn` is the interesting one: reflecting in both axes is the same linear map
 * as rotating 180°, and a rotation can ride along in the MP4 header. So a video
 * mirrored both ways gets the instant, pixel-perfect path instead of a re-encode.
 */
export type FlipPlan = { kind: "half-turn" } | { kind: "mirror"; axis: MirrorAxis };

/** `null` when neither mirror is on and there's nothing to do. */
export function planFlip({ horizontal, vertical }: Mirror): FlipPlan | null {
  if (horizontal && vertical) return { kind: "half-turn" };
  if (horizontal) return { kind: "mirror", axis: "horizontal" };
  if (vertical) return { kind: "mirror", axis: "vertical" };
  return null;
}

export interface FlipResult {
  blob: Blob;
  filename: string;
  /** False when the original packets were copied across and the pixels are untouched. */
  videoReEncoded: boolean;
}

/**
 * Mirror a video, taking the cheapest route that gets there.
 *
 * A single mirror has no header field to hide in — MP4's display matrix can express
 * one, but Mediabunny only writes rotations — so every frame is decoded, reflected on
 * a canvas and re-encoded to AVC. Both mirrors together collapse to a half turn, which
 * is metadata, so that case hands off to `rotateVideo` and copies the packets.
 *
 * Files carrying their own rotation are handled by Mediabunny itself: setting `process`
 * makes it bake that rotation into the frames first, so the sample arriving at the
 * canvas is already the right way up and reflecting it reflects what the viewer sees.
 */
export async function flipVideo(
  file: File,
  mirror: Mirror,
  onProgress?: (progress: number) => void,
): Promise<FlipResult> {
  const plan = planFlip(mirror);
  if (!plan) throw new Error("Pick a direction to mirror in first.");

  const filename = `${getBaseName(file.name)}_flipped.mp4`;

  if (plan.kind === "half-turn") {
    const turned = await rotateVideo(file, 180, {}, onProgress);
    return { ...turned, filename };
  }

  const { Output, Conversion, Mp4OutputFormat, BufferTarget } = await import("mediabunny");

  const input = await createInput(file);

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This file has no video track to flip.");

    await assertAudioDecodable(input);

    // Display dimensions, so a file that declares its own rotation is already accounted
    // for. A mirror never changes the size of the frame.
    const canvas = new OffscreenCanvas(track.displayWidth, track.displayHeight);
    // No alpha: the output is AVC in an MP4, which can't carry it anyway, and an opaque
    // canvas is the faster one to read back for every frame of the video.
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Cannot flip — this browser wouldn't give us a 2D canvas.");

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });

    const conversion = await Conversion.init({
      input,
      output,
      video: {
        // The frames are being redrawn anyway, so leave no rotation in the header for a
        // player to apply on top of a mirror it knows nothing about.
        allowRotationMetadata: false,
        codec: "avc",
        processedWidth: track.displayWidth,
        processedHeight: track.displayHeight,
        process: (sample) => {
          // Read the size off each sample rather than trusting the track header: a
          // video that changes resolution mid-stream still lands inside its canvas.
          const w = sample.displayWidth;
          const h = sample.displayHeight;
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          // Negate one axis, then slide the origin the full width (or height) back the
          // other way so the reflected frame lands on the canvas instead of beside it.
          if (plan.axis === "horizontal") ctx.setTransform(-1, 0, 0, 1, w, 0);
          else ctx.setTransform(1, 0, 0, -1, 0, h);

          sample.draw(ctx, 0, 0, w, h);
          return canvas;
        },
      },
      audio: await audioOptionsFor(input),
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error("Cannot flip — your browser doesn't support video encoding. Try Chrome or Edge.");
    }

    assertAudioNotDiscarded(conversion);

    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    return {
      blob: new Blob([output.target.buffer!], { type: "video/mp4" }),
      filename,
      videoReEncoded: true,
    };
  } finally {
    input[Symbol.dispose]();
  }
}

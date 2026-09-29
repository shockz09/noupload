/**
 * JPEG quality presets that mean the same thing on every browser.
 *
 * A quality number is not portable: Chrome and Firefox encode canvas JPEG
 * with libjpeg-turbo, Safari with Apple's ImageIO, and at the same "80"
 * Safari keeps far more detail (and bytes). So a preset names how the result
 * should look, and each encoder gets the number that delivers it.
 *
 * The numbers come from SSIMULACRA2 labels on ~12k image crops and 423
 * held-out whole images (ml/jpeg-quality on the jpeg-quality-model branch):
 *  - balanced: ~90% of images score 70 or more (a difference shows only when
 *    flipping between the two).
 *  - high: ~87% score 80 or more (not noticeable side by side); on Firefox
 *    almost all, because at q90 and up it stops subsampling colour.
 * Safari's numbers match libjpeg-turbo's on the same crops.
 *
 * A per-image model was built too and beat these fixed numbers by only 4-9%
 * of bytes, not enough to justify its 3MB download; it is parked on that
 * branch.
 */

export type JpegEncoder = "libjpeg-turbo" | "imageio";
export type QualityPreset = "balanced" | "high";

const PRESET_QUALITY: Record<JpegEncoder, Record<QualityPreset, number>> = {
  "libjpeg-turbo": { balanced: 76, high: 90 },
  imageio: { balanced: 50, high: 70 },
};

let encoderPromise: Promise<JpegEncoder> | null = null;

/**
 * Which encoder `canvas.toBlob("image/jpeg")` uses here, judged by what it
 * produces rather than by the user agent: libjpeg-turbo writes the standard
 * IJG quantisation table at q50, which starts 16, 11, 12, 14; ImageIO does not.
 */
export function detectJpegEncoder(): Promise<JpegEncoder> {
  encoderPromise ??= (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#c84c1c";
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#1a1612";
    ctx.fillRect(4, 4, 8, 8);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.5));
    if (!blob) return "libjpeg-turbo";
    const dqt = findSegment(new Uint8Array(await blob.arrayBuffer()), 0xdb);
    const ijg = [16, 11, 12, 14, 12, 10, 16, 14];
    return dqt && ijg.every((v, i) => dqt[1 + i] === v) ? "libjpeg-turbo" : "imageio";
  })();
  return encoderPromise;
}

/** Payload of the first JPEG marker segment of the given type. */
function findSegment(bytes: Uint8Array, marker: number): Uint8Array | null {
  let i = 2; // skip SOI
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const type = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (type === marker) return bytes.subarray(i + 4, i + 2 + length);
    if (type === 0xda) break; // start of scan: no more headers
    i += 2 + length;
  }
  return null;
}

/** The JPEG quality (0-100) this browser's encoder needs for the preset. */
export async function presetJpegQuality(preset: QualityPreset): Promise<number> {
  return PRESET_QUALITY[await detectJpegEncoder()][preset];
}

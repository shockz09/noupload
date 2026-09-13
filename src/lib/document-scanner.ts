/**
 * Finding a page in a photo, and flattening it back into a rectangle.
 *
 * Both halves are scanic's: a Rust/WASM Canny pipeline for the corner search
 * and a bilinear inverse-map warp for the extraction. It replaces a hand-rolled
 * detector that found nothing on a white page against a dark desk, and an
 * "extraction" that was an axis-aligned `drawImage` crop — it cropped the
 * bounding area and stretched it, so a photo taken at an angle came out just as
 * skewed as it went in.
 *
 * scanic is loaded on demand: it is only ever needed once someone opens the
 * camera, and it carries a WASM payload that has no business in the main bundle.
 */

export interface Point {
  x: number;
  y: number;
}

export interface DetectedDocument {
  /** Top-left, top-right, bottom-right, bottom-left, in source-image pixels. */
  corners: Point[];
  confidence: number;
}

const loadScanic = () => import("scanic");

/**
 * Locate the page in a photograph.
 *
 * Returns null when no convincing quadrilateral is found, which is the normal
 * outcome for a page that runs off the edge of the frame or sits on a
 * background its own colour. Callers should fall back to manual corners rather
 * than treat it as an error.
 */
export async function detectDocument(source: HTMLCanvasElement): Promise<DetectedDocument | null> {
  const { scanDocument } = await loadScanic();
  const result = await scanDocument(source, { mode: "detect" });

  if (!result.success || !result.corners) return null;

  const { topLeft, topRight, bottomRight, bottomLeft } = result.corners;
  return {
    corners: [topLeft, topRight, bottomRight, bottomLeft],
    confidence: result.confidence ?? 0,
  };
}

/**
 * Flatten the quadrilateral back into a rectangular page.
 *
 * The output size is scanic's own, derived from the quad, so a receipt stays
 * receipt-shaped instead of being stretched onto a fixed A4-ish canvas the way
 * the previous implementation did.
 */
export async function rectifyDocument(source: HTMLCanvasElement, corners: Point[]): Promise<HTMLCanvasElement> {
  if (corners.length !== 4) {
    throw new Error("A page needs exactly four corners.");
  }

  const { extractDocument } = await loadScanic();
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const result = await extractDocument(source, { topLeft, topRight, bottomRight, bottomLeft }, { output: "canvas" });

  if (!result.success || !(result.output instanceof HTMLCanvasElement)) {
    throw new Error(result.message || "Could not flatten the page.");
  }
  return result.output;
}

/**
 * Stretch the contrast so paper reads as paper.
 *
 * A photographed page is grey and flat — lit unevenly, never near white. Taking
 * the 1st and 99th percentile rather than the true min/max means one dark speck
 * or one blown highlight cannot decide the whole mapping. Mutates in place and
 * returns the same ImageData for convenience.
 */
export function enhanceDocument(imageData: ImageData): ImageData {
  const { data } = imageData;
  const histogram = new Array<number>(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)]++;
  }

  const totalPixels = data.length / 4;
  const tail = totalPixels * 0.01;

  let min = 0;
  for (let level = 0, seen = 0; level < 256; level++) {
    seen += histogram[level];
    if (seen > tail) {
      min = level;
      break;
    }
  }

  let max = 255;
  for (let level = 255, seen = 0; level >= 0; level--) {
    seen += histogram[level];
    if (seen > tail) {
      max = level;
      break;
    }
  }

  const range = max - min;
  if (range <= 0) return imageData;

  // A 256-entry lookup beats recomputing the same division for every subpixel.
  const curve = new Uint8ClampedArray(256);
  for (let level = 0; level < 256; level++) {
    curve[level] = ((level - min) / range) * 255;
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = curve[data[i]];
    data[i + 1] = curve[data[i + 1]];
    data[i + 2] = curve[data[i + 2]];
  }

  return imageData;
}

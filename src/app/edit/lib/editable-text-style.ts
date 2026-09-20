export interface EditableTextRegionInput {
  bbox: { x: number; y: number; width?: number; height?: number };
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
  text: string;
  /** Distance from the baseline to the top of the font box, in em. */
  ascent?: number;
  /** Distance from the baseline to the bottom of the font box, in em (negative in pdf.js). */
  descent?: number;
}

/**
 * Where fabric puts a line's baseline, measured down from the object's `top`,
 * as a multiple of `fontSize`: `Text._fontSizeMult * (1 - Text._fontSizeFraction)`.
 * It is not 1 -- an IText placed at the top of the glyphs it replaces would sit
 * an eighth of an em too low.
 */
export const FABRIC_BASELINE_RATIO = 1.13 * (1 - 0.222);

/**
 * An extracted region's box runs from one em above the baseline down to the
 * baseline, so `bbox.y + fontSize` is where the original glyphs sat.
 */
function baselineOf(region: EditableTextRegionInput): number {
  return region.bbox.y + region.fontSize;
}

export function buildEditableTextOptions(region: EditableTextRegionInput) {
  return {
    left: region.bbox.x,
    // Line the replacement's baseline up with the baseline it replaces, rather
    // than its box with the region's box: what a reader sees is the row the
    // glyphs sit on, and a text that rides low leaves a white gap above it.
    top: baselineOf(region) - region.fontSize * FABRIC_BASELINE_RATIO,
    fontSize: region.fontSize,
    fontFamily: region.fontFamily,
    fontWeight: region.fontWeight === "bold" || Number(region.fontWeight) >= 600 ? "bold" : region.fontWeight,
    fontStyle: region.fontStyle === "italic" ? "italic" : "normal",
    fill: region.color,
    editable: true,
    originX: "left" as const,
    originY: "top" as const,
  };
}

/**
 * Room left above and below the measured ink, in em, for the antialiasing
 * fringe and for the difference between the embedded font that drew the
 * original and the web font we measure with.
 */
const INK_MARGIN = 0.1;

/** Nothing sane reaches this far above its own baseline; a guard, not a target. */
const MAX_ASCENT = 1.2;

let inkContext: CanvasRenderingContext2D | null | undefined;

function getInkContext(): CanvasRenderingContext2D | null {
  if (inkContext !== undefined) return inkContext;
  try {
    inkContext = document.createElement("canvas").getContext("2d");
  } catch {
    inkContext = null;
  }
  return inkContext;
}

/**
 * How far this particular string's ink actually reaches above and below the
 * baseline, in em.
 *
 * A font's declared ascent is where its *plain* glyphs stop: Helvetica says
 * 0.718, but the accent on an É rides up to ~0.93. Sizing the patch off the
 * declared figure alone shaves the tips off accented capitals and leaves them
 * in the export as a row of stray marks. Measuring the region's own text is
 * what lets the patch be tight around "Billed to Jane Doe" and still tall
 * enough for "ÉTAT CIVIL".
 */
function measureInk(region: EditableTextRegionInput): { ascent: number; descent: number } | null {
  const ctx = getInkContext();
  if (!ctx || !region.text.trim() || !(region.fontSize > 0)) return null;
  const style = region.fontStyle === "italic" ? "italic " : "";
  const weight = region.fontWeight === "bold" || Number(region.fontWeight) >= 600 ? "bold " : "";
  ctx.font = `${style}${weight}${region.fontSize}px ${region.fontFamily}`;
  const metrics = ctx.measureText(region.text);
  const { actualBoundingBoxAscent: above, actualBoundingBoxDescent: below } = metrics;
  if (!Number.isFinite(above) || !Number.isFinite(below)) return null;
  return { ascent: above / region.fontSize, descent: below / region.fontSize };
}

/**
 * The white patch hides original glyphs while the corrected native PDF page
 * loads. It remains in place for OCR text baked into a scanned image.
 *
 * It has to cover every pixel the original text put on the page: an earlier
 * version inset the box vertically, which left the bottom two or three pixels
 * showing through as a grey smear in the export. But it should cover no more
 * than that. The em box is a quarter of an em taller than the tallest glyph in
 * it, and that surplus shows up on any page that isn't white as a white border
 * hanging above the text. When pdf.js hands us the font's metrics we size the
 * patch to whichever reaches further, those or the line's own measured ink,
 * plus a margin; without them (OCR'd pages) we fall back to the em box and a
 * fixed descender allowance.
 */
export function buildEditableWhiteoutOptions(region: EditableTextRegionInput) {
  const horizontalPadding = Math.max(Math.min(region.fontSize * 0.06, 2), 1);
  const verticalPadding = Math.max(Math.min(region.fontSize * 0.02, 1), 0.5);
  const bboxHeight = region.bbox.height || region.fontSize;

  let top = region.bbox.y - verticalPadding;
  let height = bboxHeight + region.fontSize * 0.22 + verticalPadding * 2;

  if (region.ascent && region.descent !== undefined) {
    const ink = measureInk(region);
    // Whichever reaches further: what the font declares, or what this string
    // actually draws. Never less than the old fixed descender allowance.
    const above = Math.min(Math.max(region.ascent, ink?.ascent ?? 0) + INK_MARGIN, MAX_ASCENT);
    const below = Math.max(Math.abs(region.descent), ink?.descent ?? 0, 0.22) + INK_MARGIN;
    const baseline = baselineOf(region);
    const inkTop = baseline - above * region.fontSize;
    const inkBottom = baseline + below * region.fontSize;
    top = inkTop - verticalPadding;
    height = inkBottom - inkTop + verticalPadding * 2;
  }

  return {
    left: region.bbox.x - horizontalPadding,
    top,
    width: (region.bbox.width || 0) + horizontalPadding * 2,
    height,
    fill: "#FFFFFF",
    stroke: "transparent",
    selectable: false,
    evented: false,
  };
}

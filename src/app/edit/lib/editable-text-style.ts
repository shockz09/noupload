export interface EditableTextRegionInput {
  bbox: { x: number; y: number; width?: number; height?: number };
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
  text: string;
}

export function buildEditableTextOptions(region: EditableTextRegionInput) {
  return {
    left: region.bbox.x,
    top: region.bbox.y + Math.max(region.fontSize * 0.08, 1),
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
 * The white patch that hides the original glyphs while their replacement is
 * being edited — and that keeps hiding them for good once the replacement is
 * deleted.
 *
 * It has to cover the region's full box. An earlier version inset the box
 * vertically to avoid touching neighbouring lines, which left the bottom two or
 * three pixels of the original text showing through as a grey smear in the
 * export. The extracted box runs from the line's top to its baseline, so the
 * extra room below is for descenders; it stays well inside normal leading.
 */
export function buildEditableWhiteoutOptions(region: EditableTextRegionInput) {
  const horizontalPadding = Math.max(Math.min(region.fontSize * 0.06, 2), 1);
  const verticalPadding = Math.max(Math.min(region.fontSize * 0.02, 1), 0.5);
  const descenderAllowance = region.fontSize * 0.22;
  const bboxHeight = region.bbox.height || region.fontSize;

  return {
    left: region.bbox.x - horizontalPadding,
    top: region.bbox.y - verticalPadding,
    width: (region.bbox.width || 0) + horizontalPadding * 2,
    height: bboxHeight + descenderAllowance + verticalPadding * 2,
    fill: "#FFFFFF",
    stroke: "transparent",
    selectable: false,
    evented: false,
  };
}

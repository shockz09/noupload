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

export function buildEditableWhiteoutOptions(region: EditableTextRegionInput) {
  const horizontalPadding = Math.max(Math.min(region.fontSize * 0.06, 2), 1);
  const verticalTrim = Math.max(region.fontSize * 0.12, 1);
  const verticalPadding = Math.max(Math.min(region.fontSize * 0.02, 1), 0.5);
  const bboxHeight = region.bbox.height || region.fontSize;
  const insetHeight = Math.max(bboxHeight - verticalTrim * 2, region.fontSize * 0.72);

  return {
    left: region.bbox.x - horizontalPadding,
    top: region.bbox.y + verticalTrim - verticalPadding,
    width: (region.bbox.width || 0) + horizontalPadding * 2,
    height: insetHeight + verticalPadding * 2,
    fill: "#FFFFFF",
    stroke: "transparent",
    selectable: false,
    evented: false,
  };
}

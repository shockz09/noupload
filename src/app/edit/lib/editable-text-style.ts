export interface EditableTextRegionInput {
  bbox: { x: number; y: number };
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

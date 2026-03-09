import type { EditorTextRecord } from "./editor-objects";

function normalizeFontToken(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
}

function getPrimaryFontFamily(fontFamily: string | undefined): string | null {
  if (!fontFamily) return null;

  const genericFamilies = new Set(["sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui"]);
  const parts = fontFamily
    .split(",")
    .map(normalizeFontToken)
    .filter(Boolean);

  for (const part of parts) {
    if (!genericFamilies.has(part)) return part;
  }

  return null;
}

function resolveFontBucket(primaryFamily: string | null): "helvetica" | "times" | "courier" | null {
  if (!primaryFamily) return null;
  if (primaryFamily.includes("helvetica") || primaryFamily.includes("arial")) return "helvetica";
  if (primaryFamily.includes("times new roman") || primaryFamily === "times" || primaryFamily.startsWith("times "))
    return "times";
  if (primaryFamily.includes("courier")) return "courier";
  return null;
}

function getRequestedStyle(record: EditorTextRecord) {
  return {
    isBold: `${record.style.fontWeight || ""}`.toLowerCase().includes("bold") || Number(record.style.fontWeight) >= 600,
    isItalic: `${record.style.fontStyle || ""}`.toLowerCase().includes("italic"),
  };
}

export function pickNativePdfFont(record: EditorTextRecord, standardFonts: Record<string, string>): string | null {
  const primaryFamily =
    record.sourceTool === "text" ? getPrimaryFontFamily(record.style.fontFamily) || "arial" : getPrimaryFontFamily(record.style.fontFamily);
  const bucket = resolveFontBucket(primaryFamily);
  if (!bucket) return null;

  const { isBold, isItalic } = getRequestedStyle(record);

  if (bucket === "helvetica") {
    if (isBold && isItalic) return standardFonts.HelveticaBoldOblique;
    if (isBold) return standardFonts.HelveticaBold;
    if (isItalic) return standardFonts.HelveticaOblique;
    return standardFonts.Helvetica;
  }

  if (bucket === "times") {
    if (isBold && isItalic) return standardFonts.TimesBoldItalic;
    if (isBold) return standardFonts.TimesBold;
    if (isItalic) return standardFonts.TimesItalic;
    return standardFonts.TimesRoman;
  }

  if (isBold && isItalic) return standardFonts.CourierBoldOblique;
  if (isBold) return standardFonts.CourierBold;
  if (isItalic) return standardFonts.CourierOblique;
  return standardFonts.Courier;
}

export function canDrawTextNatively(record: EditorTextRecord, standardFonts: Record<string, string>): boolean {
  if (record.rotation) return false;

  if (record.kind === "editedText") {
    const primaryFamily = getPrimaryFontFamily(record.style.fontFamily);
    if (!resolveFontBucket(primaryFamily)) {
      return false;
    }
  }

  const font = pickNativePdfFont(record, standardFonts);
  if (!font) return false;

  const { isBold, isItalic } = getRequestedStyle(record);
  if (isBold && !font.toLowerCase().includes("bold")) return false;
  if (isItalic && !font.toLowerCase().includes("italic") && !font.toLowerCase().includes("oblique")) return false;

  return true;
}

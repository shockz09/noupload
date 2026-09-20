
import { useCallback, useEffect, useRef, useState } from "react";
import { cleanupCanvas } from "@/lib/canvas";
import { mapToWebFont, parseFontName } from "@/lib/font";
import { loadPdfjs } from "@/lib/pdfjs-config";

export interface TextRegion {
  id: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
  pageNumber: number;
  source: "native" | "ocr";
  /** False for hidden OCR text layers whose visible letters belong to an image. */
  visibleText?: boolean;
  /** Font box above the baseline, in em. Native extraction only. */
  ascent?: number;
  /** Font box below the baseline, in em (negative). Native extraction only. */
  descent?: number;
}

interface UseTextExtractionOptions {
  file: File | null;
  pageNumber: number;
  zoom: number;
}

interface UseTextExtractionReturn {
  regions: TextRegion[];
  isExtracting: boolean;
  extractionSource: "native" | "ocr" | null;
}

export function useTextExtraction({ file, pageNumber, zoom }: UseTextExtractionOptions): UseTextExtractionReturn {
  const [regions, setRegions] = useState<TextRegion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSource, setExtractionSource] = useState<"native" | "ocr" | null>(null);

  const cacheRef = useRef<Map<string, { regions: TextRegion[]; source: "native" | "ocr" }>>(new Map());
  const currentFileRef = useRef<File | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (file !== currentFileRef.current) {
      cacheRef.current.clear();
      currentFileRef.current = file;
      setRegions([]);
      setExtractionSource(null);
    }
  }, [file]);

  const extractText = useCallback(async (requestId: number) => {
    if (!file || !pageNumber) {
      setRegions([]);
      setExtractionSource(null);
      setIsExtracting(false);
      return;
    }

    const isCurrent = () => requestIdRef.current === requestId;

    const cacheKey = `${pageNumber}-${zoom}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setRegions(cached.regions);
      setExtractionSource(cached.source);
      return;
    }

    setIsExtracting(true);
    setRegions([]);

    try {
      const nativeRegions = await extractNativeText(file, pageNumber, zoom);

      if (!isCurrent()) return;
      if (nativeRegions.length > 0) {
        cacheRef.current.set(cacheKey, { regions: nativeRegions, source: "native" });
        setRegions(nativeRegions);
        setExtractionSource("native");
        setIsExtracting(false);
        return;
      }

      const ocrRegions = await extractOCRText(file, pageNumber, zoom);
      if (!isCurrent()) return;
      cacheRef.current.set(cacheKey, { regions: ocrRegions, source: "ocr" });
      setRegions(ocrRegions);
      setExtractionSource("ocr");
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Text extraction failed:", err);
      setRegions([]);
      setExtractionSource(null);
    } finally {
      if (isCurrent()) setIsExtracting(false);
    }
  }, [file, pageNumber, zoom]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    void extractText(requestId);
    return () => {
      requestIdRef.current++;
    };
  }, [extractText]);

  return { regions, isExtracting, extractionSource };
}

/**
 * Convert RGB components (0-1) to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extract text colors from operatorList
 */
async function extractTextColors(
  page: any,
): Promise<Map<number, { color: string; visible: boolean }>> {
  const colorMap = new Map<number, { color: string; visible: boolean }>();

  try {
    const operatorList = await page.getOperatorList();
    const { OPS } = await import("pdfjs-dist");

    let currentColor = "#000000";
    let textRenderingMode = 0;
    let textIndex = 0;

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];
      const args = operatorList.argsArray[i];

      // Track fill color changes
      if (fn === OPS.setFillRGBColor && args.length >= 3) {
        currentColor = rgbToHex(args[0], args[1], args[2]);
      } else if (fn === OPS.setFillGray && args.length >= 1) {
        currentColor = rgbToHex(args[0], args[0], args[0]);
      } else if (fn === OPS.setFillCMYKColor && args.length >= 4) {
        // Simple CMYK to RGB conversion
        const [c, m, y, k] = args;
        const r = (1 - c) * (1 - k);
        const g = (1 - m) * (1 - k);
        const b = (1 - y) * (1 - k);
        currentColor = rgbToHex(r, g, b);
      } else if (fn === OPS.setTextRenderingMode) {
        textRenderingMode = args[0];
      }

      // When we see text operations, associate current color with text index
      if (fn === OPS.showText || fn === OPS.showSpacedText) {
        colorMap.set(textIndex, { color: currentColor, visible: textRenderingMode !== 3 });
        textIndex++;
      }
    }
  } catch (err) {
    console.warn("Could not extract text colors:", err);
  }

  return colorMap;
}

/**
 * Extract text using PDF.js with color and font style info
 */
async function extractNativeText(file: File, pageNumber: number, scale: number): Promise<TextRegion[]> {
  const [pdfjsLib, arrayBuffer] = await Promise.all([loadPdfjs(), file.arrayBuffer()]);
  const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer, fontExtraProperties: true }).promise;
  try {
    const pdfjsPage = await pdfjsDoc.getPage(pageNumber);
    await pdfjsPage.getOperatorList();
    const colorMap = await extractTextColors(pdfjsPage);
    return extractNativeTextWithPdfjs(pdfjsPage, pageNumber, scale, colorMap);
  } finally {
    await pdfjsDoc.destroy();
  }
}

async function extractNativeTextWithPdfjs(
  page: any,
  pageNumber: number,
  scale: number,
  colorMap: Map<number, { color: string; visible: boolean }>,
): Promise<TextRegion[]> {
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent();

  const styles =
    ((textContent as any).styles as Record<
      string,
      { fontFamily?: string; ascent?: number; descent?: number; vertical?: boolean }
    >) || {};

  const regions: TextRegion[] = [];
  let textOpIndex = 0;

  for (let i = 0; i < textContent.items.length; i++) {
    const item = textContent.items[i];
    if (!("str" in item) || !item.str.trim()) continue;

    const textItem = item as {
      str: string;
      transform: number[];
      width: number;
      height: number;
      fontName: string;
    };

    const [, , , , tx, ty] = textItem.transform;
    const fontHeight = Math.abs(textItem.transform[3]);
    const fontSize = fontHeight * scale;

    const x = tx * scale;
    const y = (viewport.height / scale - ty) * scale;
    const width = textItem.width * scale;
    const height = fontSize;
    const adjustedY = y - height;

    const styleInfo = styles[textItem.fontName];
    const fontInfo = resolvePdfjsFontInfo(page, textItem.fontName, styleInfo?.fontFamily || "");
    const appearance = colorMap.get(textOpIndex);
    const color = appearance?.color || "#000000";
    textOpIndex++;

    regions.push({
      id: `native-pdfjs-${pageNumber}-${i}`,
      text: textItem.str,
      bbox: {
        x,
        y: adjustedY,
        width: Math.max(width, 10),
        height: Math.max(height, 8),
      },
      fontSize,
      fontFamily: fontInfo.fontFamily,
      fontWeight: fontInfo.fontWeight,
      fontStyle: fontInfo.fontStyle,
      color,
      pageNumber,
      source: "native",
      visibleText: appearance?.visible ?? true,
      ascent: styleInfo?.ascent,
      descent: styleInfo?.descent,
    });
  }

  return regions;
}

function resolvePdfjsFontInfo(
  page: any,
  internalFontName: string,
  styleFontFamily: string,
): {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
} {
  const fontObject: any | null = page?.commonObjs?.has?.(internalFontName) ? page.commonObjs.get(internalFontName) : null;
  const actualFontName =
    fontObject?.name ||
    fontObject?.loadedName ||
    (styleFontFamily && !styleFontFamily.includes("g_d") ? styleFontFamily : "") ||
    internalFontName;

  const parsed = parseFontName(actualFontName || "");
  let fontWeight = parsed.fontWeight;
  let fontStyle = parsed.fontStyle;

  if (fontObject?.bold) {
    fontWeight = fontObject.black ? "900" : "bold";
  }
  if (fontObject?.italic) {
    fontStyle = "italic";
  }

  const fontFamily = parsed.fontFamily || mapToWebFont(actualFontName || "");
  return { fontFamily, fontWeight, fontStyle };
}

/**
 * Extract text using Tesseract OCR
 */
async function extractOCRText(file: File, pageNumber: number, targetScale: number): Promise<TextRegion[]> {
  const pdfjsLib = await loadPdfjs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const canvas = document.createElement("canvas");
  let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null = null;
  try {
    const page = await pdf.getPage(pageNumber);
    const ocrRenderScale = 2;
    const viewport = page.getViewport({ scale: ocrRenderScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport } as any).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value: Blob | null) => value ? resolve(value) : reject(new Error("Could not render page for OCR")), "image/png");
    });

    const Tesseract = await import("tesseract.js");
    worker = await Tesseract.createWorker("eng");
    const result = await worker.recognize(blob, {}, { blocks: true });
    const regions: TextRegion[] = [];
    const data = result.data as any;
    const scaleFactor = targetScale / ocrRenderScale;

    if (data.words) {
      for (let i = 0; i < data.words.length; i++) {
        const word = data.words[i];
        if (!word.text.trim() || word.confidence < 60) continue;
        const bbox = word.bbox;
        const height = (bbox.y1 - bbox.y0) * scaleFactor;
        regions.push({
          id: `ocr-${pageNumber}-${i}`,
          text: word.text,
          bbox: {
            x: bbox.x0 * scaleFactor,
            y: bbox.y0 * scaleFactor,
            width: (bbox.x1 - bbox.x0) * scaleFactor,
            height,
          },
          fontSize: height * 0.85,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: "normal",
          fontStyle: "normal",
          color: "#000000",
          pageNumber,
          source: "ocr",
        });
      }
    }
    return regions;
  } finally {
    await worker?.terminate();
    cleanupCanvas(canvas);
    await pdf.destroy();
  }
}

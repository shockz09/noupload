import { loadPdfjs } from "@/lib/pdfjs-config";
import { loadLibPdf } from "./libpdf";

/**
 * Redaction by replacement, not by covering.
 *
 * A black rectangle drawn over text hides nothing: the glyphs are still in the
 * content stream, and any viewer's select-all, any `pdftotext`, any text search
 * hands them straight back. Editing the content stream to cut out only the
 * covered glyphs is possible, but the failure mode is silent — miss a Form
 * XObject, a Type 3 font or an inline image and content survives that the
 * confirmation dialog promised was destroyed.
 *
 * So a redacted page is rebuilt from pixels instead. The page is rendered, the
 * redaction rectangles are painted onto the bitmap, and the page's entire
 * content stream and resource dictionary are replaced by that one image.
 * Nothing from the original page is carried over, so there is nothing left to
 * leak — the guarantee comes from what is *absent* from the output rather than
 * from having correctly identified everything that needed removing.
 *
 * What that costs: the page stops being vector art. To keep it searchable, the
 * text that survives redaction is re-added as an invisible text layer (render
 * mode 3) over the image, the same arrangement a scanner produces with OCR.
 * That layer is the one place redacted text could creep back in, so it is
 * filtered conservatively and dropped entirely if anything about the page's
 * text cannot be read with confidence.
 */

/**
 * A redaction in the editor's own coordinate space: origin top-left of the
 * unrotated page, y growing downwards, units of PDF points.
 */
export interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise degrees about the rectangle's centre. */
  rotation?: number;
}

/** Raster resolution for a redacted page. 300dpi is scan quality. */
const RENDER_DPI = 300;

/**
 * Above this, a page is re-encoded as JPEG instead of PNG. PNG keeps text
 * crisp and is the better choice for an ordinary document page; a page that is
 * mostly photography compresses terribly as PNG and needs the fallback.
 */
const PNG_BYTE_BUDGET = 4 * 1024 * 1024;
const JPEG_QUALITY = 0.92;

/** Resource name for the invisible text layer's font. */
const TEXT_LAYER_FONT = "LpRedactHelv";

interface UserSpaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rebuild every page carrying a redaction so that the redacted content is
 * absent from the output rather than covered up.
 *
 * @param pdfBytes - A fully-saved PDF. Editor annotations must already be drawn
 *   and form fields already flattened, because whatever is in these bytes is
 *   exactly what gets rasterised.
 * @param redactionsByPageIndex - Rectangles to destroy, keyed by 0-based page
 *   index *in these bytes* (not the editor's page numbering, which still counts
 *   deleted pages).
 */
export async function applyRedactions(
  pdfBytes: Uint8Array,
  redactionsByPageIndex: Map<number, RedactionRect[]>,
): Promise<Uint8Array> {
  if (redactionsByPageIndex.size === 0) return pdfBytes;

  const [libpdf, pdfjsLib] = await Promise.all([loadLibPdf(), loadPdfjs()]);
  const { PDF, PdfDict, PdfName, PdfString, PdfArray, ops } = libpdf as any;

  // getDocument takes ownership of the buffer it is handed, so pdf.js and
  // libpdf each need their own copy of the bytes.
  const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const pdf = await PDF.load(pdfBytes);
  const resolve = (ref: any) => pdf.getObject(ref);

  try {
    for (const [pageIndex, rects] of redactionsByPageIndex) {
      if (rects.length === 0) continue;
      const page = pdf.getPage(pageIndex);
      // Skipping quietly would hand back a document that looks redacted in the
      // editor and is not; there is no safe way to continue past this.
      if (!page) throw new Error(`Could not redact page ${pageIndex + 1}: the page is missing.`);

      const box = readPageBox(page, resolve);
      const targets = rects.map((rect) => toUserSpaceBox(rect, box));

      // Read the text before the page is emptied; it is the source for the
      // replacement text layer.
      const survivingText = extractSurvivingText(page, targets);

      const image = await rasterisePage({
        pdfjsDoc,
        pdfjsLib,
        pageNumber: pageIndex + 1,
        rects,
        pdf,
      });

      dropIntersectingAnnotations(page, targets, resolve, { PdfArray });

      // Everything that was on this page goes here: a fresh content stream and
      // a fresh resource dictionary mean no glyph, path, image or font from the
      // original survives into the output.
      page.dict.delete("Contents");
      page.dict.set("Resources", new PdfDict());
      // The structure tree indexes marked content that no longer exists, and
      // its /ActualText and /Alt entries can mirror the text just destroyed.
      page.dict.delete("StructParents");
      // /Thumb is a stored picture of the page as it was — the redacted content,
      // in full, one dictionary away. /PieceInfo is private application data,
      // and it is where Illustrator and InDesign keep an editable copy of the
      // artwork they produced the page from.
      page.dict.delete("Thumb");
      page.dict.delete("PieceInfo");
      page.dict.delete("Metadata");

      page.drawImage(image, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });

      drawInvisibleTextLayer(page, survivingText, { ops, PdfDict, PdfName, PdfString });
    }

    // One page's structure tree cannot be selectively rebuilt once its marked
    // content is gone, and the tree can carry the redacted text itself.
    const catalog = pdf.getCatalog();
    catalog.delete("StructTreeRoot");
    catalog.delete("MarkInfo");

    // Never incremental: an incremental save appends, leaving the original
    // page objects intact and readable earlier in the same file.
    return pdf.save({ incremental: false });
  } finally {
    await pdfjsDoc.destroy().catch(() => {});
  }
}

/**
 * The page's visible box, in PDF user space.
 *
 * Not `page.getCropBox()`: libpdf reports the box array's top-right corner as
 * its width and height, which is only the same thing when the box starts at the
 * origin. A print-ready page cropped to [27 27 630 820] comes back 27pt too
 * tall and wide, which put every redaction 27pt off the text it was covering.
 *
 * Both boxes are `[x0 y0 x1 y1]` and either may be inherited from an ancestor
 * /Pages node. CropBox is clipped to MediaBox, as a reader would.
 */
function readPageBox(page: any, resolve: (ref: any) => any): UserSpaceBox {
  const media = inheritedBox(page.dict, "MediaBox", resolve) ?? { x: 0, y: 0, width: 612, height: 792 };
  const crop = inheritedBox(page.dict, "CropBox", resolve);
  if (!crop) return media;

  const x = Math.max(crop.x, media.x);
  const y = Math.max(crop.y, media.y);
  const right = Math.min(crop.x + crop.width, media.x + media.width);
  const top = Math.min(crop.y + crop.height, media.y + media.height);
  if (right <= x || top <= y) return media;
  return { x, y, width: right - x, height: top - y };
}

function inheritedBox(dict: any, key: string, resolve: (ref: any) => any): UserSpaceBox | null {
  let node = dict;
  // Bounded in case a malformed file's /Parent chain loops back on itself.
  for (let depth = 0; node && depth < 64; depth++) {
    const items = node.getArray?.(key, resolve)?.items;
    if (items?.length === 4) {
      const values = items.map((item: any) => Number((item?.type === "ref" ? resolve(item) : item)?.value));
      if (values.every((value: number) => Number.isFinite(value))) {
        const [x0, y0, x1, y1] = values;
        return {
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          width: Math.abs(x1 - x0),
          height: Math.abs(y1 - y0),
        };
      }
    }
    const parent = node.getRef?.("Parent");
    node = parent ? resolve(parent) : null;
  }
  return null;
}

/**
 * Convert an editor rectangle (top-left origin) into PDF user space
 * (bottom-left origin), expanding a rotated rectangle to its bounding box.
 *
 * The expansion is deliberate: it is used to decide which text to *withhold*
 * from the replacement layer, and covering more than was asked is the safe
 * direction to err in. The visual redaction itself is painted at the true
 * rotated angle onto the bitmap.
 */
function toUserSpaceBox(rect: RedactionRect, box: UserSpaceBox): UserSpaceBox {
  const { width, height } = boundsOf(rect);
  const centreX = rect.x + rect.width / 2;
  const centreY = rect.y + rect.height / 2;
  const left = centreX - width / 2;
  const top = centreY - height / 2;

  return {
    x: box.x + left,
    y: box.y + box.height - top - height,
    width,
    height,
  };
}

/** Axis-aligned extent of a rectangle rotated about its centre. */
function boundsOf(rect: RedactionRect): { width: number; height: number } {
  const angle = ((rect.rotation || 0) * Math.PI) / 180;
  if (!angle) return { width: rect.width, height: rect.height };

  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    width: rect.width * cos + rect.height * sin,
    height: rect.width * sin + rect.height * cos,
  };
}

interface SurvivingChar {
  char: string;
  x: number;
  baseline: number;
  fontSize: number;
}

/**
 * Every character on the page that no redaction touches.
 *
 * Returns an empty list rather than a partial one if the page's text cannot be
 * read: a missing search layer is a cosmetic loss, whereas a text layer built
 * from text we failed to understand is exactly the leak this module exists to
 * prevent.
 */
function extractSurvivingText(page: any, targets: UserSpaceBox[]): SurvivingChar[] {
  let pageText: any;
  try {
    pageText = page.extractText();
  } catch {
    return [];
  }
  if (!pageText?.lines) return [];

  const survivors: SurvivingChar[] = [];
  for (const line of pageText.lines) {
    for (const span of line.spans || []) {
      for (const char of span.chars || []) {
        const bbox = char?.bbox;
        if (!bbox || !char.char) return [];
        if (targets.some((target) => intersects(target, bbox))) continue;
        survivors.push({
          char: char.char,
          x: bbox.x,
          baseline: typeof char.baseline === "number" ? char.baseline : bbox.y,
          fontSize: char.fontSize || span.fontSize || 12,
        });
      }
    }
  }
  return survivors;
}

/** Any overlap at all counts, including a glyph only clipped at its edge. */
function intersects(a: UserSpaceBox, b: UserSpaceBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Render the page and paint the redactions onto the pixels.
 *
 * Rendered unrotated so the bitmap sits in the page's own coordinate space;
 * the page's /Rotate is left alone and keeps applying to the image. Annotations
 * are excluded from the render because they survive as annotations — drawing
 * them here too would double them up.
 */
async function rasterisePage({
  pdfjsDoc,
  pdfjsLib,
  pageNumber,
  rects,
  pdf,
}: {
  pdfjsDoc: any;
  pdfjsLib: any;
  pageNumber: number;
  rects: RedactionRect[];
  pdf: any;
}): Promise<any> {
  const scale = RENDER_DPI / 72;
  const pdfjsPage = await pdfjsDoc.getPage(pageNumber);
  const viewport = pdfjsPage.getViewport({ scale, rotation: 0 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas to redact the page with.");

  // A PDF page is transparent where nothing is drawn; a viewer paints it white.
  // Without this the untouched areas would come out black once flattened.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfjsPage.render({
    canvasContext: ctx,
    viewport,
    annotationMode: pdfjsLib.AnnotationMode?.DISABLE ?? 0,
  }).promise;
  pdfjsPage.cleanup();

  ctx.fillStyle = "#000000";
  for (const rect of rects) {
    const angle = ((rect.rotation || 0) * Math.PI) / 180;
    if (!angle) {
      ctx.fillRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
      continue;
    }
    ctx.save();
    ctx.translate((rect.x + rect.width / 2) * scale, (rect.y + rect.height / 2) * scale);
    ctx.rotate(angle);
    ctx.fillRect((-rect.width / 2) * scale, (-rect.height / 2) * scale, rect.width * scale, rect.height * scale);
    ctx.restore();
  }

  const png = await canvasBytes(canvas, "image/png");
  if (png.byteLength <= PNG_BYTE_BUDGET) return pdf.embedPng(png);

  const jpeg = await canvasBytes(canvas, "image/jpeg", JPEG_QUALITY);
  return pdf.embedJpeg(jpeg);
}

async function canvasBytes(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) throw new Error("Could not encode the redacted page.");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Remove annotations overlapping a redaction.
 *
 * Annotations are not part of the content stream, so rasterising the page does
 * not touch them: a highlight, a stamp or a comment sitting over the redacted
 * area would still be there, appearance and text intact. Annotations elsewhere
 * on the page are left alone so links keep working.
 */
function dropIntersectingAnnotations(
  page: any,
  targets: UserSpaceBox[],
  resolve: (ref: any) => any,
  { PdfArray }: { PdfArray: any },
): void {
  const annots = page.dict.getArray("Annots", resolve);
  if (!annots) return;

  const kept: any[] = [];
  for (const entry of annots.items ?? annots) {
    const dict = entry?.type === "ref" ? resolve(entry) : entry;
    const rect = dict?.getArray?.("Rect", resolve);
    const values = (rect?.items ?? rect ?? []).map((item: any) => (item?.type === "ref" ? resolve(item) : item));
    // Anything not added to `kept` is dropped. An annotation whose placement
    // cannot be read might be over the redaction, so it goes rather than get
    // the benefit of the doubt.
    if (values.length !== 4) continue;
    const [x1, y1, x2, y2] = values.map((item: any) => Number(item?.value ?? 0));
    const bbox: UserSpaceBox = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
    if (targets.some((target) => intersects(target, bbox))) continue;
    kept.push(entry);
  }

  if (kept.length === 0) page.dict.delete("Annots");
  else page.dict.set("Annots", new PdfArray(kept));
}

/**
 * Re-add the surviving text over the image, invisibly, so the page stays
 * searchable and selectable.
 *
 * Each character is positioned individually, so for ordinary horizontal text
 * the selection rectangles land on the glyphs in the image. Text that was set
 * at an angle is re-laid horizontally from its bounding box, which reads back
 * correctly but highlights in the wrong place. Helvetica is used regardless of
 * the original face — the shapes come from the bitmap, so the only thing this
 * font affects is the advance width of text nobody sees.
 */
function drawInvisibleTextLayer(
  page: any,
  survivors: SurvivingChar[],
  { ops, PdfDict, PdfName, PdfString }: { ops: any; PdfDict: any; PdfName: any; PdfString: any },
): void {
  if (survivors.length === 0) return;

  const operators: any[] = [ops.pushGraphicsState(), ops.beginText(), ops.setTextRenderMode(3)];
  let lastSize = Number.NaN;
  let drew = false;

  for (const survivor of survivors) {
    const encoded = encodeWinAnsi(survivor.char);
    if (!encoded) continue;
    const size = survivor.fontSize > 0 ? survivor.fontSize : 12;
    if (size !== lastSize) {
      operators.push(ops.setFont(TEXT_LAYER_FONT, size));
      lastSize = size;
    }
    operators.push(ops.setTextMatrix(1, 0, 0, 1, survivor.x, survivor.baseline));
    operators.push(ops.showText(PdfString.fromBytes(encoded)));
    drew = true;
  }

  if (!drew) return;
  operators.push(ops.endText(), ops.popGraphicsState());

  // The font resource is built by hand rather than through registerFont so the
  // encoding is pinned to the one encodeWinAnsi produces.
  const font = new PdfDict();
  font.set("Type", PdfName.of("Font"));
  font.set("Subtype", PdfName.of("Type1"));
  font.set("BaseFont", PdfName.of("Helvetica"));
  font.set("Encoding", PdfName.of("WinAnsiEncoding"));

  const resources = page.getResources();
  // Add to whatever /Font dict is there rather than replacing it, so this stays
  // correct if anything else ever registers a font on a redacted page.
  const fonts = resources.getDict("Font") ?? new PdfDict();
  fonts.set(TEXT_LAYER_FONT, font);
  resources.set("Font", fonts);

  page.drawOperators(operators);
}

/**
 * WinAnsi's departures from Latin-1, which occupy the C1 control range.
 */
const WINANSI_EXTRAS: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/**
 * Encode text for the standard Helvetica face, or return null if it does not
 * fit. Characters outside WinAnsi — CJK, and most of the rest of Unicode — are
 * left out of the search layer rather than mangled into the wrong glyph.
 */
function encodeWinAnsi(text: string): Uint8Array | null {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      bytes[i] = code;
      continue;
    }
    const extra = WINANSI_EXTRAS[text[i]];
    if (extra === undefined) return null;
    bytes[i] = extra;
  }
  return bytes;
}

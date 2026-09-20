/// <reference lib="webworker" />

import type { TextRemovalRect } from "./remove-original-text";

declare const self: DedicatedWorkerGlobalScope;

interface Request {
  id: number;
  bytes: Uint8Array;
  rectangles: [number, TextRemovalRect[]][];
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const { id, bytes, rectangles } = data;
  try {
    const mupdf = await import("mupdf");
    const opened = mupdf.Document.openDocument(bytes, "application/pdf");
    if (opened.needsPassword()) {
      opened.destroy();
      throw new Error("This PDF needs a password before its text can be edited.");
    }
    const pdf = opened.asPDF();
    if (!pdf) {
      opened.destroy();
      throw new Error("Could not open the PDF for text editing.");
    }

    try {
      for (const [pageIndex, regions] of rectangles) {
        const page = pdf.loadPage(pageIndex);
        for (const rect of regions) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          const annotation = page.createAnnotation("Redact");
          annotation.setRect([rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]);
        }
        // No painted box. Preserve images and line art, removing only glyphs
        // touched by the edit region. The replacement text is drawn afterwards.
        page.applyRedactions(false, 0, 0, 0);
      }
      const result = new Uint8Array(pdf.saveToBuffer("compress=yes,garbage=deduplicate").asUint8Array());
      self.postMessage({ id, bytes: result }, [result.buffer]);
    } finally {
      pdf.destroy();
    }
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

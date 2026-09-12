/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

export interface MupdfWorkerMessage {
  id: string;
  inputData: Uint8Array;
}

export interface MupdfWorkerResponse {
  id: string;
  success: boolean;
  data?: Uint8Array;
  error?: string;
}

/**
 * MuPDF's structural rewrite: merge duplicate objects, drop unreferenced ones,
 * pack everything into object streams and recompress at maximum deflate effort.
 * Nothing here touches a pixel or a glyph that the document draws.
 *
 * Deliberately absent: `clean` and `sanitize`, which rewrite the content streams
 * themselves. They find another ~2.5% on a big book, but they also reshuffle the
 * order operators are written in, and that changes the order text comes out in
 * when the reader copies or searches it. Measured on a 634-page book, extracted
 * text was byte-identical without them and reordered with them — not a trade a
 * compressor should make on the user's behalf.
 */
const SAVE_OPTIONS = [
  "compress=yes",
  "compress-fonts=yes",
  "compress-images=yes",
  "garbage=deduplicate",
  "objstms=yes",
  "compression-effort=100",
].join(",");

self.onmessage = async (event: MessageEvent<MupdfWorkerMessage>) => {
  const { id, inputData } = event.data;

  try {
    // Loaded lazily: the WASM is ~10MB, and this engine only runs when the
    // cheaper ones came up short.
    const mupdf = await import("mupdf");

    const opened = mupdf.Document.openDocument(inputData, "application/pdf");
    // Without this, an encrypted document saves as a valid-looking file whose
    // content is gone — reported to the user as a successful compression.
    if (opened.needsPassword()) throw new Error("PASSWORD_PROTECTED");

    const doc = opened.asPDF();
    if (!doc) throw new Error("Not a PDF");

    try {
      // Experimental upstream, so a failure here must not lose the rest of the
      // savings — fall through to the plain rewrite instead.
      doc.subsetFonts();
    } catch (error) {
      console.warn("[mupdf worker] font subsetting skipped:", error);
    }

    const result = new Uint8Array(doc.saveToBuffer(SAVE_OPTIONS).asUint8Array());
    doc.destroy();

    self.postMessage({ id, success: true, data: result } as MupdfWorkerResponse, [result.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    } as MupdfWorkerResponse);
  }
};

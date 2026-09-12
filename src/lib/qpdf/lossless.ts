import type { QpdfWorkerMessage, QpdfWorkerResponse } from "./types";

const LOSSLESS_TIMEOUT_MS = 120_000;

/**
 * Repacks a PDF with qpdf: recompressed streams, object streams, no re-encoding
 * of any image.
 *
 * This is the safety net behind Ghostscript. On text- and font-heavy documents
 * (born-digital books, exports from PDFTron/iText) pdfwrite regularly returns a
 * file *larger* than the input, and the compressor would then have nothing to
 * show for itself. qpdf still finds 5-15% on those files without touching a
 * single pixel, so the user gets a real reduction instead of a shrug.
 */
export async function losslessShrink(bytes: Uint8Array): Promise<Uint8Array> {
  const worker = new Worker(new URL("./qpdf.worker.ts", import.meta.url), { type: "module" });

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Lossless pass timed out")), LOSSLESS_TIMEOUT_MS);

      worker.addEventListener("message", (event: MessageEvent<QpdfWorkerResponse>) => {
        clearTimeout(timeout);
        const { success, data, error } = event.data;
        if (success && data) resolve(data);
        else reject(new Error(error || "Lossless pass failed"));
      });

      worker.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message || "Lossless pass worker failed"));
      });

      // Copy the buffer: the caller still needs the original bytes
      const inputData = new Uint8Array(bytes);
      const message: QpdfWorkerMessage = {
        id: "lossless",
        operation: "compress",
        inputData,
        options: { level: 9 },
      };
      worker.postMessage(message, [inputData.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

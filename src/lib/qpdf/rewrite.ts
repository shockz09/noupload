import type { QpdfWorkerMessage, QpdfWorkerResponse } from "./types";

const REWRITE_TIMEOUT_MS = 60_000;

/**
 * Rewrites a PDF's structure with qpdf, keeping the page content identical.
 *
 * Some PDFs in the wild contain malformed objects (e.g. an empty numeric token)
 * that lenient viewers such as pdf.js skip over but pdf-lib refuses to parse.
 * Running the bytes through qpdf normalizes the file so pdf-lib can load it.
 *
 * Uses a throwaway worker instead of the shared `useQpdf` one: this runs only on
 * the fallback path, so paying the WASM start-up cost beats holding the worker
 * (and its ~10MB module) alive for every tool that might need a repair.
 */
export async function rewritePdfBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const worker = new Worker(new URL("./qpdf.worker.ts", import.meta.url), { type: "module" });

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("PDF repair timed out")), REWRITE_TIMEOUT_MS);

      worker.addEventListener("message", (event: MessageEvent<QpdfWorkerResponse>) => {
        clearTimeout(timeout);
        const { success, data, error } = event.data;
        if (success && data) resolve(data);
        else reject(new Error(error || "PDF repair failed"));
      });

      worker.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message || "PDF repair worker failed"));
      });

      // Copy the buffer: the caller still needs the original bytes if repair fails
      const inputData = new Uint8Array(bytes);
      const message: QpdfWorkerMessage = { id: "rewrite", operation: "rewrite", inputData };
      worker.postMessage(message, [inputData.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

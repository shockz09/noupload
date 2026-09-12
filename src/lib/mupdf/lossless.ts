import type { MupdfWorkerMessage, MupdfWorkerResponse } from "./lossless.worker";

const MUPDF_TIMEOUT_MS = 180_000;

/**
 * Second lossless engine, run only when the others come up short.
 *
 * qpdf and MuPDF are good at different things: qpdf wins on files whose bulk is
 * stream data, MuPDF on documents carrying fat embedded fonts and messy content
 * streams — exactly the born-digital books and report exports where Ghostscript
 * gives back a *larger* file. Measured on a 9MB, 634-page book: qpdf 6.9%,
 * MuPDF 13.7%. It costs a ~10MB WASM download, so the caller only reaches for it
 * when the cheap passes have already disappointed.
 */
export async function mupdfLosslessShrink(bytes: Uint8Array): Promise<Uint8Array> {
  const worker = new Worker(new URL("./lossless.worker.ts", import.meta.url), { type: "module" });

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("MuPDF pass timed out")), MUPDF_TIMEOUT_MS);

      worker.addEventListener("message", (event: MessageEvent<MupdfWorkerResponse>) => {
        clearTimeout(timeout);
        const { success, data, error } = event.data;
        if (success && data) resolve(data);
        else reject(new Error(error || "MuPDF pass failed"));
      });

      worker.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message || "MuPDF worker failed"));
      });

      // Copy the buffer: the caller still needs the original bytes
      const inputData = new Uint8Array(bytes);
      const message: MupdfWorkerMessage = { id: "mupdf-lossless", inputData };
      worker.postMessage(message, [inputData.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

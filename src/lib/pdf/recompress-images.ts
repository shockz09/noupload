import type { DocumentProfile, RecompressMessage, RecompressResponse } from "./recompress-images.worker";

export type { DocumentProfile };

const RECOMPRESS_TIMEOUT_MS = 300_000;

export interface RecompressResult {
  data: Uint8Array;
  converted: number;
  total: number;
}

/**
 * Reads what the document is made of, so the caller can route to the right
 * engine instead of trying each one. One parse, a second or two, against the
 * ~20s that a pointless Ghostscript pass costs on a long book.
 */
export async function probeDocument(bytes: Uint8Array): Promise<DocumentProfile | null> {
  const worker = new Worker(new URL("./recompress-images.worker.ts", import.meta.url), { type: "module" });

  try {
    return await new Promise<DocumentProfile | null>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Document probe timed out")), 60_000);

      worker.addEventListener("message", (event: MessageEvent<RecompressResponse>) => {
        clearTimeout(timeout);
        const { success, profile, error } = event.data;
        if (success) resolve(profile ?? null);
        else reject(new Error(error || "Document probe failed"));
      });

      worker.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message || "Document probe worker failed"));
      });

      const inputData = new Uint8Array(bytes);
      const message: RecompressMessage = { id: "probe", inputData, quality: 0, probeOnly: true };
      worker.postMessage(message, [inputData.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

/**
 * Replaces the lossless photos in a Ghostscript intermediate with MozJPEG.
 *
 * Ghostscript's own JPEG encoder is plain libjpeg: no trellis quantisation and
 * unoptimised Huffman tables. Letting it downsample but not encode, then doing
 * the single lossy pass with MozJPEG, lands the same image quality (matched per
 * image by SSIM) in 7-13% fewer bytes.
 */
export async function recompressImages(
  bytes: Uint8Array,
  quality: number,
  onProgress?: (message: string) => void,
): Promise<RecompressResult> {
  return runRecompress({ id: "recompress", inputData: new Uint8Array(bytes), quality }, onProgress);
}

async function runRecompress(
  message: RecompressMessage,
  onProgress?: (message: string) => void,
): Promise<RecompressResult> {
  const worker = new Worker(new URL("./recompress-images.worker.ts", import.meta.url), { type: "module" });

  try {
    return await new Promise<RecompressResult>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Image re-encoding timed out")), RECOMPRESS_TIMEOUT_MS);

      worker.addEventListener("message", (event: MessageEvent<RecompressResponse>) => {
        const { success, data, error, progress, converted = 0, total = 0 } = event.data;

        if (progress) {
          onProgress?.(progress);
          return;
        }

        clearTimeout(timeout);
        if (success && data) resolve({ data, converted, total });
        else reject(new Error(error || "Image re-encoding failed"));
      });

      worker.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message || "Image re-encoding worker failed"));
      });

      worker.postMessage(message, [message.inputData.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

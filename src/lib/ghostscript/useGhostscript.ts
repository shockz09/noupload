import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompressionLevel,
  GsImageFormat,
  GsOperation,
  GsWorkerMessage,
  GsWorkerResponse,
  PdfALevel,
} from "./types";

export { COMPRESSION_DESCRIPTIONS, PDFA_DESCRIPTIONS } from "./types";
export type { CompressionLevel, PdfALevel };

export interface UseGhostscriptResult {
  compress: (file: File, level?: CompressionLevel, imageFormat?: GsImageFormat) => Promise<Uint8Array>;
  toGrayscale: (file: File) => Promise<Uint8Array>;
  toPdfA: (file: File, level?: PdfALevel) => Promise<Uint8Array>;
  isLoading: boolean;
  progress: string;
  error: string | null;
  /** Terminates the Ghostscript worker to free its WASM heap. */
  release: () => void;
}

export function useGhostscript(): UseGhostscriptResult {
  const workerRef = useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<
    Map<
      string,
      {
        resolve: (data: Uint8Array) => void;
        reject: (error: Error) => void;
      }
    >
  >(new Map());

  /**
   * Started on demand rather than on mount, and torn down again by `release()`.
   *
   * Ghostscript's WASM heap grows to hundreds of megabytes on a big document and
   * Emscripten never gives that memory back — only killing the worker does. On a
   * phone, holding that for the rest of the session is the difference between a
   * working tab and one the browser kills.
   */
  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL("./ghostscript.worker.ts", import.meta.url), { type: "module" });

    worker.onmessage = (event: MessageEvent<GsWorkerResponse>) => {
      const { id, success, data, error: errorMsg, progress: progressMsg } = event.data;

      // Handle progress updates
      if (progressMsg) {
        setProgress(progressMsg);
        return;
      }

      const pending = pendingRef.current.get(id);
      if (!pending) return;

      pendingRef.current.delete(id);

      if (success && data) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(errorMsg || "Operation failed"));
      }
    };

    worker.onerror = (event) => {
      console.error("[useGhostscript] Worker error:", event);
      setError("Worker error occurred");
    };

    workerRef.current = worker;
    return worker;
  }, []);

  /** Hands Ghostscript's heap back to the device. Safe to call when idle. */
  const release = useCallback(() => {
    if (!workerRef.current || pendingRef.current.size > 0) return;
    workerRef.current.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Generic operation executor
  const executeOperation = useCallback(
    async (
      operation: GsOperation,
      file: File,
      options?: { level?: CompressionLevel; pdfaLevel?: PdfALevel; imageFormat?: GsImageFormat },
    ): Promise<Uint8Array> => {
      const worker = ensureWorker();

      setIsLoading(true);
      setError(null);
      setProgress("Starting...");

      try {
        const id = crypto.randomUUID();
        const inputData = await file.arrayBuffer();

        const result = await new Promise<Uint8Array>((resolve, reject) => {
          pendingRef.current.set(id, { resolve, reject });

          worker.postMessage(
            {
              id,
              operation,
              inputData,
              options,
            } as GsWorkerMessage,
            [inputData],
          );
        });

        setProgress("Done!");
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Operation failed";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [ensureWorker],
  );

  const compress = useCallback(
    async (
      file: File,
      level: CompressionLevel = "balanced",
      imageFormat: GsImageFormat = "jpeg",
    ): Promise<Uint8Array> => {
      return executeOperation("compress", file, { level, imageFormat });
    },
    [executeOperation],
  );

  const toGrayscale = useCallback(
    async (file: File): Promise<Uint8Array> => {
      return executeOperation("grayscale", file);
    },
    [executeOperation],
  );

  const toPdfA = useCallback(
    async (file: File, level: PdfALevel = "1b"): Promise<Uint8Array> => {
      return executeOperation("pdfa", file, { pdfaLevel: level });
    },
    [executeOperation],
  );

  return { compress, toGrayscale, toPdfA, isLoading, progress, error, release };
}

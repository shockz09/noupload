"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompressionLevel,
  GsCompressionPreset,
  GsOperation,
  GsWorkerMessage,
  GsWorkerResponse,
  PdfALevel,
} from "./types";
import { COMPRESSION_PRESET_MAP } from "./types";

export type { CompressionLevel, PdfALevel };
export { COMPRESSION_DESCRIPTIONS, PDFA_DESCRIPTIONS } from "./types";

export interface UseGhostscriptResult {
  compress: (file: File, level?: CompressionLevel) => Promise<Uint8Array>;
  toGrayscale: (file: File) => Promise<Uint8Array>;
  toPdfA: (file: File, level?: PdfALevel) => Promise<Uint8Array>;
  isLoading: boolean;
  progress: string;
  error: string | null;
}

export function useGhostscript(): UseGhostscriptResult {
  const workerRef = useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Map<string, {
    resolve: (data: Uint8Array) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // Initialize worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./ghostscript.worker.ts", import.meta.url),
      { type: "module" },
    );

    workerRef.current.onmessage = (event: MessageEvent<GsWorkerResponse>) => {
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

    workerRef.current.onerror = (event) => {
      console.error("[useGhostscript] Worker error:", event);
      setError("Worker error occurred");
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Generic operation executor
  const executeOperation = useCallback(
    async (
      operation: GsOperation,
      file: File,
      options?: { preset?: GsCompressionPreset; pdfaLevel?: PdfALevel },
    ): Promise<Uint8Array> => {
      if (!workerRef.current) {
        throw new Error("Worker not initialized");
      }

      setIsLoading(true);
      setError(null);
      setProgress("Starting...");

      try {
        const id = crypto.randomUUID();
        const inputData = await file.arrayBuffer();

        const result = await new Promise<Uint8Array>((resolve, reject) => {
          pendingRef.current.set(id, { resolve, reject });

          workerRef.current!.postMessage(
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
    [],
  );

  const compress = useCallback(
    async (file: File, level: CompressionLevel = "balanced"): Promise<Uint8Array> => {
      const preset = COMPRESSION_PRESET_MAP[level];
      return executeOperation("compress", file, { preset });
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

  return { compress, toGrayscale, toPdfA, isLoading, progress, error };
}

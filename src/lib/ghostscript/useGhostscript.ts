"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompressionLevel,
  GsCompressionPreset,
  GsWorkerMessage,
  GsWorkerResponse,
} from "./types";
import { COMPRESSION_PRESET_MAP } from "./types";

export type { CompressionLevel };
export { COMPRESSION_DESCRIPTIONS } from "./types";

export interface UseGhostscriptResult {
  compress: (file: File, level?: CompressionLevel) => Promise<Uint8Array>;
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
        pending.reject(new Error(errorMsg || "Compression failed"));
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

  const compress = useCallback(
    async (file: File, level: CompressionLevel = "balanced"): Promise<Uint8Array> => {
      if (!workerRef.current) {
        throw new Error("Worker not initialized");
      }

      setIsLoading(true);
      setError(null);
      setProgress("Starting...");

      try {
        const id = crypto.randomUUID();
        const inputData = await file.arrayBuffer();
        const preset: GsCompressionPreset = COMPRESSION_PRESET_MAP[level];

        const result = await new Promise<Uint8Array>((resolve, reject) => {
          pendingRef.current.set(id, { resolve, reject });

          workerRef.current!.postMessage(
            {
              id,
              inputData,
              preset,
            } as GsWorkerMessage,
            [inputData],
          );
        });

        setProgress("Done!");
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Compression failed";
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { compress, isLoading, progress, error };
}

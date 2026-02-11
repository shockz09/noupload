"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BgRemovalResponse, ModelQuality } from "./background-removal.worker";

export type { ModelQuality };

export const MODEL_DESCRIPTIONS: Record<ModelQuality, string> = {
  medium: "Good quality, faster processing",
  high: "Best quality, slower processing",
};

export interface BackgroundRemovalResult {
  blob: Blob;
  url: string;
}

export interface UseBackgroundRemovalResult {
  removeBackground: (image: File | Blob, model?: ModelQuality) => Promise<BackgroundRemovalResult>;
  isProcessing: boolean;
  progress: string;
  error: string | null;
}

// Singleton worker instance - persists across hook instances
let sharedWorker: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (result: BackgroundRemovalResult) => void;
    reject: (error: Error) => void;
    setProgress: (msg: string) => void;
  }
>();

function getOrCreateWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL("./background-removal.worker.ts", import.meta.url), { type: "module" });

    sharedWorker.onmessage = (event: MessageEvent<BgRemovalResponse>) => {
      const { id, success, data, error: errorMsg, progress: progressMsg } = event.data;

      const pending = pendingRequests.get(id);
      if (!pending) return;

      // Handle progress updates
      if (progressMsg && !success) {
        pending.setProgress(progressMsg);
        return;
      }

      if (success && data) {
        pendingRequests.delete(id);
        const blob = new Blob([data], { type: "image/png" });
        const url = URL.createObjectURL(blob);
        pending.resolve({ blob, url });
      } else if (errorMsg) {
        pendingRequests.delete(id);
        pending.reject(new Error(errorMsg));
      }
    };

    sharedWorker.onerror = (event) => {
      console.error("[bg-removal] Worker error:", event);
    };
  }
  return sharedWorker;
}

export function useBackgroundRemoval(): UseBackgroundRemovalResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Get shared worker on mount
  useEffect(() => {
    workerRef.current = getOrCreateWorker();
  }, []);

  const processImage = useCallback(
    async (image: File | Blob, model: ModelQuality = "medium"): Promise<BackgroundRemovalResult> => {
      if (!workerRef.current) {
        throw new Error("Worker not initialized");
      }

      setIsProcessing(true);
      setError(null);
      setProgress("Removing background...");

      try {
        const id = crypto.randomUUID();
        const imageData = await image.arrayBuffer();

        const result = await new Promise<BackgroundRemovalResult>((resolve, reject) => {
          pendingRequests.set(id, { resolve, reject, setProgress });

          workerRef.current!.postMessage(
            {
              id,
              imageData,
              mimeType: image.type || "image/png",
              model,
            },
            [imageData],
          );
        });

        setProgress("Done!");
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove background";
        setError(message);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  return {
    removeBackground: processImage,
    isProcessing,
    progress,
    error,
  };
}

// Utility: Composite foreground onto solid color background
export async function compositeOnColor(
  foregroundUrl: string,
  color: string,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Fill with background color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Draw foreground
  const img = new Image();
  img.src = foregroundUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // Clean up canvas to free memory
      canvas.width = 0;
      canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error("Failed to create blob"));
    }, "image/png");
  });
}

// Utility: Composite foreground onto image background
export async function compositeOnImage(
  foregroundUrl: string,
  backgroundUrl: string,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Load background image
  const bgImg = new Image();
  bgImg.src = backgroundUrl;
  await new Promise((resolve, reject) => {
    bgImg.onload = resolve;
    bgImg.onerror = reject;
  });

  // Draw background (cover fit)
  const bgAspect = bgImg.width / bgImg.height;
  const canvasAspect = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (bgAspect > canvasAspect) {
    drawWidth = height * bgAspect;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawHeight = width / bgAspect;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);

  // Draw foreground
  const fgImg = new Image();
  fgImg.src = foregroundUrl;
  await new Promise((resolve, reject) => {
    fgImg.onload = resolve;
    fgImg.onerror = reject;
  });
  ctx.drawImage(fgImg, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // Clean up canvas to free memory
      canvas.width = 0;
      canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error("Failed to create blob"));
    }, "image/png");
  });
}

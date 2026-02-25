"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DeviceCapability =
  | { device: "webgpu"; dtype: "fp16" }
  | { device: "webgpu"; dtype: "fp32" }
  | { device: "wasm"; dtype: "fp32" };

export interface ProgressState {
  phase: "idle" | "downloading" | "building" | "ready" | "processing" | "error";
  progress: number;
  errorMsg?: string;
}

export interface BackgroundRemovalResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  processingTimeSeconds: number;
}

export interface UseBackgroundRemovalResult {
  removeBackground: (image: File | Blob) => Promise<BackgroundRemovalResult>;
  isProcessing: boolean;
  progress: ProgressState;
  error: string | null;
  capability: DeviceCapability | null;
}

export function useBackgroundRemoval(): UseBackgroundRemovalResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ phase: "idle", progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [capability, setCapability] = useState<DeviceCapability | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Detect capabilities and subscribe to progress on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { getCapabilities, subscribeToProgress } = await import("rembg-webgpu");

        // Subscribe to library progress events
        unsubRef.current = subscribeToProgress((state) => {
          if (cancelled) return;
          setProgress({
            phase: state.phase as ProgressState["phase"],
            progress: state.progress,
            errorMsg: state.errorMsg,
          });
        });

        const cap = await getCapabilities();
        if (!cancelled) setCapability(cap as DeviceCapability);
      } catch {
        // Capabilities detection is non-critical
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, []);

  const processImage = useCallback(
    async (image: File | Blob): Promise<BackgroundRemovalResult> => {
      setIsProcessing(true);
      setError(null);
      setProgress({ phase: "processing", progress: -1 });

      try {
        const { removeBackground: rembgRemove } = await import("rembg-webgpu");

        // Create an object URL for the input image
        const inputUrl = URL.createObjectURL(image);

        try {
          // Suppress benign onnxruntime warnings that trigger Next.js dev error overlay
          const origError = console.error;
          console.error = (...args: unknown[]) => {
            if (typeof args[0] === "string" && args[0].includes("VerifyEachNodeIsAssignedToAnEp")) return;
            origError.apply(console, args);
          };

          let result: Awaited<ReturnType<typeof rembgRemove>>;
          try {
            result = await rembgRemove(inputUrl);
          } finally {
            console.error = origError;
          }

          // Fetch the blob from the result URL
          const response = await fetch(result.blobUrl);
          const blob = await response.blob();

          setProgress({ phase: "ready", progress: 100 });

          return {
            blob,
            url: result.blobUrl,
            width: result.width,
            height: result.height,
            processingTimeSeconds: result.processingTimeSeconds,
          };
        } finally {
          URL.revokeObjectURL(inputUrl);
        }
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
    capability,
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

/// <reference lib="webworker" />

import { type Config, removeBackground } from "@imgly/background-removal";

declare const self: DedicatedWorkerGlobalScope;

export type ModelQuality = "medium" | "high";

export interface BgRemovalMessage {
  id: string;
  imageData: ArrayBuffer;
  mimeType: string;
  model: ModelQuality;
}

export interface BgRemovalResponse {
  id: string;
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
  progress?: string;
}

const MODEL_MAP: Record<ModelQuality, string> = {
  medium: "isnet_fp16",
  high: "isnet",
};

self.onmessage = async (event: MessageEvent<BgRemovalMessage>) => {
  const { id, imageData, mimeType, model } = event.data;

  try {
    const blob = new Blob([imageData], { type: mimeType });

    const config: Config = {
      model: MODEL_MAP[model] as "isnet" | "isnet_fp16",
      output: {
        format: "image/png",
        quality: 0.9,
      },
      progress: (key, current, total) => {
        if (key.includes("fetch") && total > 0) {
          const percentage = Math.round((current / total) * 100);
          if (percentage < 100) {
            self.postMessage({
              id,
              success: false,
              progress: `Downloading AI model... ${percentage}%`,
            } as BgRemovalResponse);
          } else {
            self.postMessage({
              id,
              success: false,
              progress: "Removing background...",
            } as BgRemovalResponse);
          }
        }
      },
    };

    // Send initial progress
    self.postMessage({
      id,
      success: false,
      progress: "Removing background...",
    } as BgRemovalResponse);

    const result = await removeBackground(blob, config);

    // Convert result to ArrayBuffer
    const resultBlob = result instanceof Blob ? result : new Blob([result], { type: "image/png" });
    const arrayBuffer = await resultBlob.arrayBuffer();

    self.postMessage(
      {
        id,
        success: true,
        data: arrayBuffer,
      } as BgRemovalResponse,
      [arrayBuffer],
    );
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove background",
    } as BgRemovalResponse);
  }
};

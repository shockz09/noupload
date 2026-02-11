/**
 * Canvas utilities for image/PDF rendering and cleanup
 * Centralizes canvas creation, rendering, and memory cleanup patterns
 */

import { loadPdfjs } from "./pdfjs-config";

export interface CanvasRenderResult {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cleanup: () => void;
}

/**
 * Create a canvas with specified dimensions
 * Returns canvas, context, and cleanup function
 */
export function createCanvas(width: number, height: number): CanvasRenderResult {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const cleanup = () => {
    canvas.width = 0;
    canvas.height = 0;
  };

  return { canvas, ctx, cleanup };
}

/**
 * Render a PDF page to a canvas
 * Returns the canvas, viewport, and cleanup function
 */
export async function renderPageToCanvas(
  file: File | ArrayBuffer,
  pageNumber: number,
  scale: number,
): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewport: { width: number; height: number };
  cleanup: () => void;
}> {
  const pdfjsLib = await loadPdfjs();

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const { canvas, ctx, cleanup } = createCanvas(viewport.width, viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();

  return {
    canvas,
    ctx,
    viewport: { width: viewport.width, height: viewport.height },
    cleanup,
  };
}

/**
 * Convert a canvas to a Blob with proper typing
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob from canvas"));
      },
      mimeType,
      quality,
    );
  });
}

/**
 * Clean up a canvas by zeroing its dimensions (releases memory)
 */
export function cleanupCanvas(canvas: HTMLCanvasElement | null): void {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Load an image from a File/Blob/URL and return an HTMLImageElement
 * Automatically revokes the object URL on cleanup
 */
export async function loadImage(source: File | Blob | string): Promise<{
  img: HTMLImageElement;
  cleanup: () => void;
}> {
  const img = new Image();
  const url = typeof source === "string" ? source : URL.createObjectURL(source);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const cleanup = () => {
    if (typeof source !== "string") {
      URL.revokeObjectURL(url);
    }
  };

  return { img, cleanup };
}

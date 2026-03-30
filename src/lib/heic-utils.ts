// HEIC conversion utilities - separate file to avoid bundling libheif-js with image-utils
// Uses heic-decode (backed by libheif-js 1.19.x) which handles modern iPhone HEIC variants

interface HeicDecoded {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

async function decodeHeic(file: File): Promise<HeicDecoded> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decode = (await import("heic-decode" as any)).default as (opts: { buffer: Uint8Array }) => Promise<HeicDecoded>;
  const buffer = new Uint8Array(await file.arrayBuffer());
  return decode({ buffer });
}

function heicToCanvas(decoded: HeicDecoded): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const ctx = canvas.getContext("2d")!;
  const pixels = new Uint8ClampedArray(decoded.data);
  const imageData = new ImageData(pixels, decoded.width, decoded.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function canvasToTargetBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
  fillWhiteBg: boolean,
): Promise<Blob> {
  if (fillWhiteBg) {
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const ctx = bgCanvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    canvas = bgCanvas;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image from HEIC"))),
      mimeType,
      quality,
    );
  });
}

// General HEIC converter — decodes to raw pixels then encodes via canvas
export async function convertHeic(
  file: File,
  toType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  quality: number = 0.92,
): Promise<Blob> {
  const decoded = await decodeHeic(file);
  const canvas = heicToCanvas(decoded);
  const fillWhiteBg = toType === "image/jpeg";
  return canvasToTargetBlob(canvas, toType, quality, fillWhiteBg);
}

// Convenience alias used by the dedicated HEIC → JPEG page
export const convertHeicToJpeg = (file: File): Promise<Blob> => convertHeic(file, "image/jpeg", 0.92);

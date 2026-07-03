// GIF compression: decode with gifuct-js, re-encode with gifenc at a smaller palette/scale/frame rate

import { getBaseName } from "./utils";

export interface GifCompressOptions {
  colors: number; // palette size, 2-256
  scale: number; // 0.25 - 1
  frameSkip: number; // 1 = keep every frame, 2 = keep every other frame, etc.
}

export interface GifCompressResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

// GIF dimensions must be even for the encoder; never round a dimension down to 0.
function evenDimension(value: number): number {
  const rounded = Math.max(1, Math.round(value));
  return rounded & ~1 || rounded;
}

export async function compressGif(
  file: File,
  options: GifCompressOptions,
  onProgress?: (progress: number) => void,
): Promise<GifCompressResult> {
  const { parseGIF, decompressFrames } = await import("gifuct-js");
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");

  const buffer = await file.arrayBuffer();
  const gif = parseGIF(buffer);
  const rawFrames = decompressFrames(gif, true);

  const width = gif.lsd.width;
  const height = gif.lsd.height;
  const outW = evenDimension(width * options.scale);
  const outH = evenDimension(height * options.scale);
  const needsScale = outW !== width || outH !== height;

  // Canvas holds the full composited frame; disposal methods (background/previous)
  // are applied here before each new frame's patch is drawn on top.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const scaleCanvas = document.createElement("canvas");
  scaleCanvas.width = outW;
  scaleCanvas.height = outH;
  const scaleCtx = scaleCanvas.getContext("2d", { willReadFrequently: true })!;

  const encoder = GIFEncoder();
  let previousImageData: ImageData | null = null;
  let previousDisposal = 0;

  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i];

    if (previousDisposal === 2) {
      ctx.clearRect(0, 0, width, height);
    } else if (previousDisposal === 3 && previousImageData) {
      ctx.putImageData(previousImageData, 0, 0);
    }

    if (frame.disposalType === 3) {
      previousImageData = ctx.getImageData(0, 0, width, height);
    }

    const patch = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    ctx.putImageData(patch, frame.dims.left, frame.dims.top);
    previousDisposal = frame.disposalType;

    if (i % options.frameSkip !== 0) continue;

    let data: Uint8ClampedArray;
    if (needsScale) {
      scaleCtx.clearRect(0, 0, outW, outH);
      scaleCtx.drawImage(canvas, 0, 0, outW, outH);
      data = scaleCtx.getImageData(0, 0, outW, outH).data;
    } else {
      data = ctx.getImageData(0, 0, width, height).data;
    }

    const palette = quantize(data, options.colors);
    const index = applyPalette(data, palette);
    const delay = Math.round((frame.delay || 100) * options.frameSkip);
    encoder.writeFrame(index, outW, outH, { palette, delay });

    onProgress?.((i + 1) / rawFrames.length);
  }

  encoder.finish();

  const blob = new Blob([encoder.bytes() as BlobPart], { type: "image/gif" });
  const filename = `${getBaseName(file.name)}_compressed.gif`;

  return { blob, filename, originalSize: file.size, compressedSize: blob.size };
}

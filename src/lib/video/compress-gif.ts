// GIF compression via gifsicle compiled to WebAssembly (gifsicle-wasm-browser) — the same
// battle-tested optimizer/lossy-compressor real desktop gifsicle uses, running fully
// client-side. This replaces an earlier hand-rolled gifuct-js/gifenc pipeline: gifsicle's
// `-O3` does real cross-frame delta encoding with cropped sub-rectangles (dirty-rect
// diffing), which a from-scratch encoder can't easily replicate, plus a purpose-built
// lossy algorithm and quantizer that beat naive per-frame re-encoding on both size and
// visual quality.

import { getBaseName } from "./utils";

export interface GifCompressOptions {
  colors: number; // palette size, 2-256
  lossy: number; // 0 = off, otherwise 1-200 (gifsicle recommends 30-60 for a balanced result)
  optimize: 1 | 2 | 3; // gifsicle -O level; 3 gives the best cross-frame diffing but is slower
  scale: number; // 0.25 - 1
  dither?: boolean; // smooths banding from color reduction, at some file size cost
}

export interface GifCompressResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

export async function compressGif(
  file: File,
  options: GifCompressOptions,
  onProgress?: (progress: number) => void,
): Promise<GifCompressResult> {
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  onProgress?.(0);

  const flags = [`-O${options.optimize}`, `--colors ${options.colors}`];
  if (options.lossy > 0) flags.push(`--lossy=${options.lossy}`);
  if (options.scale !== 1) flags.push(`--scale ${options.scale}`);
  if (options.dither) flags.push("--dither");

  const [output] = await gifsicle.run({
    input: [{ file, name: "in.gif" }],
    command: [`${flags.join(" ")} in.gif -o /out/out.gif`],
  });

  onProgress?.(1);

  if (!output) throw new Error("GIF compression failed: gifsicle produced no output");

  const filename = `${getBaseName(file.name)}_compressed.gif`;
  return { blob: output, filename, originalSize: file.size, compressedSize: output.size };
}

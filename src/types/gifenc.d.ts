declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };

  export function quantize(
    rgba: Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean | number },
  ): number[][];

  export function applyPalette(
    rgba: Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}

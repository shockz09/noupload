// Ghostscript operations
export type GsOperation = "compress" | "grayscale" | "pdfa";

// User-friendly compression levels
export type CompressionLevel = "light" | "balanced" | "maximum";

/** How Ghostscript should store colour and grayscale images. */
export type GsImageFormat = "jpeg" | "flate";

// PDF/A conformance levels
export type PdfALevel = "1b" | "2b" | "3b";

/**
 * One pdfwrite pass: target image resolution plus the JPEG QFactor handed to
 * pdfwrite's distiller dictionaries (higher QFactor = more loss = smaller).
 */
export interface CompressionPass {
  /** Target DPI for colour and grayscale images. */
  resolution: number;
  /** Target DPI for 1-bit images; text scans fall apart below ~300. */
  monoResolution: number;
  /** pdfwrite JPEG QFactor: 0.15 ≈ near-lossless, 2.4 ≈ heavy artefacting. */
  qFactor: number;
}

/**
 * Passes are tried in order and the smallest output wins. A single pass is
 * enough for image-heavy files; the later passes exist for PDFs where the first
 * one barely moves the needle, so a user who asked for compression still gets
 * compression instead of "nothing to do here".
 */
export const COMPRESSION_LADDER: Record<CompressionLevel, CompressionPass[]> = {
  light: [
    { resolution: 200, monoResolution: 600, qFactor: 0.6 },
    { resolution: 150, monoResolution: 450, qFactor: 0.9 },
  ],
  balanced: [
    { resolution: 120, monoResolution: 400, qFactor: 0.9 },
    { resolution: 96, monoResolution: 300, qFactor: 1.3 },
  ],
  maximum: [
    { resolution: 72, monoResolution: 300, qFactor: 1.8 },
    { resolution: 56, monoResolution: 200, qFactor: 2.4 },
  ],
};

/**
 * MozJPEG quality per level, picked so the page renders at least as well as
 * Ghostscript's own encoder does at that level's QFactor — measured as SSIM
 * against the same pages with their images left undegraded.
 *
 * MozJPEG's trellis quantisation and optimised Huffman tables buy roughly 10-20%
 * at equal quality, so these numbers sit below the QFactor they replace and
 * still score the same or better: on a 120 DPI scan, Ghostscript managed SSIM
 * 0.985 in 531KB where q66 gets 0.988 in ~450KB.
 */
export const MOZJPEG_QUALITY: Record<CompressionLevel, number> = {
  light: 78,
  balanced: 66,
  maximum: 44,
};

/**
 * Savings that make a pass "good enough" to stop the ladder early, so the common
 * case still costs a single Ghostscript run.
 */
export const GOOD_ENOUGH_SAVINGS: Record<CompressionLevel, number> = {
  light: 0.15,
  balanced: 0.25,
  maximum: 0.4,
};

// Preset descriptions for UI
export const COMPRESSION_DESCRIPTIONS: Record<CompressionLevel, string> = {
  light: "Keeps images near print quality (~200 DPI)",
  balanced: "Good balance of quality and size (~120 DPI)",
  maximum: "Smallest file, screen quality (~72 DPI)",
};

// PDF/A level descriptions
export const PDFA_DESCRIPTIONS: Record<PdfALevel, string> = {
  "1b": "PDF/A-1b — Basic conformance, most compatible",
  "2b": "PDF/A-2b — Supports JPEG2000, transparency",
  "3b": "PDF/A-3b — Allows embedded files",
};

// Worker message types
export interface GsWorkerMessage {
  id: string;
  operation: GsOperation;
  inputData: ArrayBuffer;
  options?: {
    level?: CompressionLevel;
    pdfaLevel?: PdfALevel;
    /**
     * "flate" keeps images lossless so a better JPEG encoder can have the one
     * and only lossy pass at them afterwards.
     */
    imageFormat?: GsImageFormat;
  };
}

export interface GsWorkerResponse {
  id: string;
  success: boolean;
  data?: Uint8Array;
  error?: string;
  progress?: string;
}

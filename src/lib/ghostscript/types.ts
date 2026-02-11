// Ghostscript operations
export type GsOperation = "compress" | "grayscale" | "pdfa";

// Ghostscript compression presets
export type GsCompressionPreset = "screen" | "ebook" | "printer" | "prepress";

// User-friendly compression levels
export type CompressionLevel = "light" | "balanced" | "maximum";

// PDF/A conformance levels
export type PdfALevel = "1b" | "2b" | "3b";

// Map user-friendly levels to Ghostscript presets
export const COMPRESSION_PRESET_MAP: Record<CompressionLevel, GsCompressionPreset> = {
  light: "printer", // 300 DPI - minimal quality loss
  balanced: "ebook", // 150 DPI - good balance
  maximum: "screen", // 72 DPI - smallest file
};

// Preset descriptions for UI
export const COMPRESSION_DESCRIPTIONS: Record<CompressionLevel, string> = {
  light: "Best quality, larger file (~30-50% reduction)",
  balanced: "Good balance of quality and size (~50-80% reduction)",
  maximum: "Smallest file, lower quality (~80-95% reduction)",
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
    preset?: GsCompressionPreset;
    pdfaLevel?: PdfALevel;
  };
}

export interface GsWorkerResponse {
  id: string;
  success: boolean;
  data?: Uint8Array;
  error?: string;
  progress?: string;
}

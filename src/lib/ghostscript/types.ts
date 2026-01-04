// Ghostscript compression presets
export type GsCompressionPreset = "screen" | "ebook" | "printer" | "prepress";

// User-friendly compression levels
export type CompressionLevel = "light" | "balanced" | "maximum";

// Map user-friendly levels to Ghostscript presets
export const COMPRESSION_PRESET_MAP: Record<CompressionLevel, GsCompressionPreset> = {
  light: "printer",    // 300 DPI - minimal quality loss
  balanced: "ebook",   // 150 DPI - good balance
  maximum: "screen",   // 72 DPI - smallest file
};

// Preset descriptions for UI
export const COMPRESSION_DESCRIPTIONS: Record<CompressionLevel, string> = {
  light: "Best quality, larger file (~30-50% reduction)",
  balanced: "Good balance of quality and size (~50-80% reduction)",
  maximum: "Smallest file, lower quality (~80-95% reduction)",
};

// Worker message types
export interface GsWorkerMessage {
  id: string;
  inputData: ArrayBuffer;
  preset: GsCompressionPreset;
}

export interface GsWorkerResponse {
  id: string;
  success: boolean;
  data?: Uint8Array;
  error?: string;
  progress?: string;
}

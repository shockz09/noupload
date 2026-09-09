import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared file size formatter - used across audio, image, and PDF tools
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileBaseName(filename: string): string {
  return filename.split(".").slice(0, -1).join(".") || filename;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

// Size change as a human-readable string. Re-encoding can grow a file (input was
// already optimized, or the codec's overhead beats the savings), so this never
// claims a file got "smaller" when it did not.
export function formatSizeDelta(originalSize: number, newSize: number): string {
  const sizes = `${formatFileSize(originalSize)} → ${formatFileSize(newSize)}`;
  if (originalSize <= 0) return sizes;
  const percent = Math.round((1 - newSize / originalSize) * 100);
  if (percent > 0) return `${sizes} · ${percent}% smaller`;
  if (percent < 0) return `${sizes} · ${-percent}% larger`;
  return `${sizes} · same size`;
}

// Result line for a compressor, which hands back the original untouched when it
// can't beat it.
export function formatCompressionResult(originalSize: number, newSize: number, keptOriginal: boolean): string {
  if (keptOriginal) return `${formatFileSize(originalSize)} · already optimized, original kept`;
  return formatSizeDelta(originalSize, newSize);
}

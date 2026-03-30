// HEIC conversion utilities - separate file to avoid bundling heic2any (1.3MB) with image-utils

// General HEIC converter (lazy loads heic2any only when called)
export async function convertHeic(
  file: File,
  toType: "image/jpeg" | "image/png" = "image/jpeg",
  quality: number = 0.92,
): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;

  const result = await heic2any({
    blob: file,
    toType,
    quality,
  });

  // heic2any returns Blob or Blob[]
  return Array.isArray(result) ? result[0] : result;
}

// Convenience alias used by the dedicated HEIC → JPEG page
export const convertHeicToJpeg = (file: File): Promise<Blob> => convertHeic(file, "image/jpeg", 0.92);

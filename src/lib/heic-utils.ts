// HEIC conversion utilities - separate file to avoid bundling heic2any (1.3MB) with image-utils

// Convert HEIC to JPEG (lazy loads heic2any only when called)
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;

  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  // heic2any returns Blob or Blob[]
  return Array.isArray(result) ? result[0] : result;
}

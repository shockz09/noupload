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
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  try {
    return await convertHeic(file, "image/jpeg", 0.92);
  } catch {
    // heic2any's libheif can't parse some newer HEIC variants —
    // fall back to native browser rendering (works on Safari)
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(img.src);
            if (blob) resolve(blob);
            else reject(new Error("Failed to create JPEG from HEIC"));
          },
          "image/jpeg",
          0.92,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Could not convert this HEIC file. Try opening it in Photos and re-exporting as JPEG first."));
      };
      img.src = URL.createObjectURL(file);
    });
  }
}

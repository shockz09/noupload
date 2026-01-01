// Image processing utilities - all client-side using Canvas API

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rotation?: number;
}

export interface AdjustmentOptions {
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  saturation?: number; // -100 to 100
}

export type ImageFormat = "png" | "jpeg" | "webp";
export type FilterType = "grayscale" | "sepia" | "invert" | "90s" | "glitch" | "cyber" | "thermal" | "noir" | "sunset" | "frost";
export type FlipDirection = "horizontal" | "vertical";

// Helper: Load image from file
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Helper: Canvas to Blob
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat = "png",
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      mimeType,
      quality
    );
  });
}

// Helper: Get format from filename
export function getFormatFromFilename(filename: string): ImageFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "webp") return "webp";
  return "png";
}

// Get image dimensions
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  const img = await loadImage(file);
  try {
    return { width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Compress image
export async function compressImage(
  file: File,
  quality: number = 0.8,
  maxWidth?: number,
  maxHeight?: number
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    let width = img.width;
    let height = img.height;

    // Scale down if max dimensions provided
    if (maxWidth && width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    if (maxHeight && height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);

    // Use JPEG for compression (better compression than PNG)
    return await canvasToBlob(canvas, "jpeg", quality);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Resize image
export async function resizeImage(
  file: File,
  width: number,
  height: number,
  maintainAspect: boolean = true
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    let targetWidth = width;
    let targetHeight = height;

    if (maintainAspect) {
      const aspectRatio = img.width / img.height;
      if (width / height > aspectRatio) {
        targetWidth = height * aspectRatio;
      } else {
        targetHeight = width / aspectRatio;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Convert image format
export async function convertFormat(
  file: File,
  format: ImageFormat,
  quality: number = 0.92
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d")!;

    // For JPEG, fill white background (no transparency)
    if (format === "jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    return await canvasToBlob(canvas, format, quality);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Convert HEIC to JPEG (requires heic2any library)
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  // Dynamic import to avoid loading if not needed
  const heic2any = (await import("heic2any")).default;

  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  // heic2any returns Blob or Blob[]
  return Array.isArray(result) ? result[0] : result;
}

// Crop image
export async function cropImage(file: File, crop: CropArea): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Rotate image
export async function rotateImage(
  file: File,
  degrees: 0 | 90 | 180 | 270
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    if (degrees === 90 || degrees === 270) {
      canvas.width = img.height;
      canvas.height = img.width;
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Flip image
export async function flipImage(
  file: File,
  direction: FlipDirection
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d")!;

    if (direction === "horizontal") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }

    ctx.drawImage(img, 0, 0);

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Strip metadata (re-encoding removes EXIF)
export async function stripMetadata(file: File): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Adjust brightness, contrast, saturation
export async function adjustImage(
  file: File,
  options: AdjustmentOptions
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d")!;

    // Build filter string
    const filters: string[] = [];

    if (options.brightness !== undefined) {
      filters.push(`brightness(${100 + options.brightness}%)`);
    }
    if (options.contrast !== undefined) {
      filters.push(`contrast(${100 + options.contrast}%)`);
    }
    if (options.saturation !== undefined) {
      filters.push(`saturate(${100 + options.saturation}%)`);
    }

    ctx.filter = filters.join(" ") || "none";
    ctx.drawImage(img, 0, 0);

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Apply filter (grayscale, sepia, invert, 90s, duotone)
export async function applyFilter(
  file: File,
  filter: FilterType
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d")!;

    // Pixel-based filters
    if (filter === "cyber") {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Boost contrast
        r = Math.min(255, Math.max(0, (r - 128) * 1.4 + 128));
        g = Math.min(255, Math.max(0, (g - 128) * 1.4 + 128));
        b = Math.min(255, Math.max(0, (b - 128) * 1.4 + 128));

        // Shift to neon purple/cyan
        const lum = (r * 0.299 + g * 0.587 + b * 0.114);

        // Dark areas -> deep purple, bright areas -> electric cyan
        if (lum < 128) {
          r = Math.min(255, r * 0.6 + 80);
          g = Math.min(255, g * 0.3);
          b = Math.min(255, b * 0.8 + 120);
        } else {
          r = Math.min(255, r * 0.4);
          g = Math.min(255, g * 0.9 + 60);
          b = Math.min(255, b * 0.9 + 80);
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }

      ctx.putImageData(imageData, 0, 0);
    } else if (filter === "thermal") {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Thermal gradient: black -> blue -> purple -> red -> orange -> yellow -> white
      const thermalGradient = [
        { pos: 0, r: 0, g: 0, b: 0 },
        { pos: 0.15, r: 20, g: 0, b: 80 },
        { pos: 0.3, r: 80, g: 0, b: 120 },
        { pos: 0.45, r: 180, g: 0, b: 60 },
        { pos: 0.6, r: 255, g: 80, b: 0 },
        { pos: 0.75, r: 255, g: 180, b: 0 },
        { pos: 0.9, r: 255, g: 255, b: 100 },
        { pos: 1, r: 255, g: 255, b: 255 },
      ];

      const getThermalColor = (t: number) => {
        for (let i = 0; i < thermalGradient.length - 1; i++) {
          const c1 = thermalGradient[i];
          const c2 = thermalGradient[i + 1];
          if (t >= c1.pos && t <= c2.pos) {
            const f = (t - c1.pos) / (c2.pos - c1.pos);
            return {
              r: c1.r + (c2.r - c1.r) * f,
              g: c1.g + (c2.g - c1.g) * f,
              b: c1.b + (c2.b - c1.b) * f,
            };
          }
        }
        return thermalGradient[thermalGradient.length - 1];
      };

      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        const c = getThermalColor(lum);
        data[i] = c.r;
        data[i + 1] = c.g;
        data[i + 2] = c.b;
      }

      ctx.putImageData(imageData, 0, 0);
    } else if (filter === "noir") {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale
        let lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // High contrast curve - crush shadows, blow highlights
        lum = lum < 80 ? lum * 0.3 : lum > 180 ? 255 - (255 - lum) * 0.3 : (lum - 80) * 2.55;
        lum = Math.min(255, Math.max(0, lum));
        data[i] = data[i + 1] = data[i + 2] = lum;
      }

      ctx.putImageData(imageData, 0, 0);
    } else if (filter === "sunset") {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Warm orange/pink tones - boost reds, shift greens to yellow, reduce blues
        data[i] = Math.min(255, data[i] * 1.15 + 20);
        data[i + 1] = Math.min(255, data[i + 1] * 1.05 + 10);
        data[i + 2] = Math.max(0, data[i + 2] * 0.7);
      }

      ctx.putImageData(imageData, 0, 0);
    } else if (filter === "frost") {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Cool blue tones, slightly desaturated
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = Math.min(255, data[i] * 0.7 + avg * 0.2);
        data[i + 1] = Math.min(255, data[i + 1] * 0.85 + avg * 0.1 + 10);
        data[i + 2] = Math.min(255, data[i + 2] * 1.1 + 30);
      }

      ctx.putImageData(imageData, 0, 0);
    } else if (filter === "glitch") {
      const w = canvas.width;
      const h = canvas.height;
      const offset = Math.max(4, Math.floor(w * 0.012)); // ~1.2% of width

      // Draw shifted red channel
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(img, 0, 0);

      // Get original image data
      const original = ctx.getImageData(0, 0, w, h);

      // Create output
      const output = ctx.createImageData(w, h);
      const src = original.data;
      const dst = output.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;

          // Red from left-shifted position
          const rx = Math.min(w - 1, x + offset);
          const ri = (y * w + rx) * 4;

          // Blue from right-shifted position
          const bx = Math.max(0, x - offset);
          const bi = (y * w + bx) * 4;

          dst[i] = src[ri];         // Red from right
          dst[i + 1] = src[i + 1];  // Green stays
          dst[i + 2] = src[bi + 2]; // Blue from left
          dst[i + 3] = src[i + 3];  // Alpha
        }
      }

      ctx.putImageData(output, 0, 0);
    } else {
      switch (filter) {
        case "grayscale":
          ctx.filter = "grayscale(100%)";
          break;
        case "sepia":
          ctx.filter = "sepia(100%)";
          break;
        case "invert":
          ctx.filter = "invert(100%)";
          break;
        case "90s":
          ctx.filter = "brightness(118%) contrast(72%) saturate(85%) hue-rotate(18deg)";
          break;
      }
      ctx.drawImage(img, 0, 0);
    }

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Add text watermark
export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const fontSize = options.fontSize || Math.max(20, img.width / 20);
    const color = options.color || "#000000";
    const opacity = options.opacity ?? 0.5;
    const rotation = options.rotation || 0;

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;

    const textWidth = ctx.measureText(options.text).width;
    const textHeight = fontSize;

    let x: number, y: number;
    const padding = 20;

    switch (options.position || "center") {
      case "top-left":
        x = padding;
        y = padding + textHeight;
        break;
      case "top-right":
        x = img.width - textWidth - padding;
        y = padding + textHeight;
        break;
      case "bottom-left":
        x = padding;
        y = img.height - padding;
        break;
      case "bottom-right":
        x = img.width - textWidth - padding;
        y = img.height - padding;
        break;
      case "center":
      default:
        x = (img.width - textWidth) / 2;
        y = (img.height + textHeight) / 2;
    }

    if (rotation) {
      ctx.save();
      ctx.translate(x + textWidth / 2, y - textHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillText(options.text, -textWidth / 2, textHeight / 2);
      ctx.restore();
    } else {
      ctx.fillText(options.text, x, y);
    }

    ctx.globalAlpha = 1;

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Add border
export async function addBorder(
  file: File,
  borderWidth: number,
  borderColor: string
): Promise<Blob> {
  const img = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width + borderWidth * 2;
    canvas.height = img.height + borderWidth * 2;

    const ctx = canvas.getContext("2d")!;

    // Fill border color
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image in center
    ctx.drawImage(img, borderWidth, borderWidth);

    const format = getFormatFromFilename(file.name);
    return await canvasToBlob(canvas, format);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Image to Base64
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generate favicons (modern 2025 setup)
export interface FaviconSet {
  svg?: Blob; // Primary: SVG (if uploaded as SVG)
  ico48: Blob; // Fallback: 48x48 PNG
  apple180: Blob; // iOS Safari
  android192: Blob; // Android
  android512: Blob; // Android/PWA
}

export async function generateFavicons(file: File): Promise<FaviconSet> {
  const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg");

  const result: Partial<FaviconSet> = {};

  // If SVG uploaded, include it as primary
  if (isSvg) {
    result.svg = file;
  }

  // Generate PNG sizes
  const img = await loadImage(file);

  try {
    const sizes = [
      { name: "ico48", size: 48 },
      { name: "apple180", size: 180 },
      { name: "android192", size: 192 },
      { name: "android512", size: 512 },
    ];

    for (const { name, size } of sizes) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);

      result[name as keyof FaviconSet] = await canvasToBlob(canvas, "png");
    }

    return result as FaviconSet;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

// Download helper
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy image to clipboard
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    // Clipboard API requires PNG format
    let pngBlob = blob;
    if (blob.type !== "image/png") {
      // Convert to PNG using canvas
      const img = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to convert"))), "image/png");
      });
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    return true;
  } catch {
    return false;
  }
}

// Download multiple images (with stagger to prevent browser blocking)
export async function downloadMultipleImages(
  images: Array<{ blob: Blob; filename: string }>
): Promise<void> {
  for (const { blob, filename } of images) {
    downloadImage(blob, filename);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Bulk process helper
export async function bulkProcess<T>(
  files: File[],
  processor: (file: File) => Promise<T>,
  onProgress?: (current: number, total: number) => void,
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, files.length), files.length);
    }
  }

  return results;
}

// Re-export formatFileSize from shared utils
export { formatFileSize } from "./utils";

// Get output filename with new extension
export function getOutputFilename(
  originalFilename: string,
  newFormat?: ImageFormat,
  suffix?: string
): string {
  const parts = originalFilename.split(".");
  const ext = parts.pop();
  const name = parts.join(".");
  const newExt = newFormat || ext || "png";
  return suffix ? `${name}${suffix}.${newExt}` : `${name}.${newExt}`;
}

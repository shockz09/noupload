import { PDFDocument } from "pdf-lib";

export interface ConvertedImage {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
}

// Detect if device is low-end (mobile or low memory)
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  // @ts-ignore - deviceMemory not in all browsers
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  return isMobile || lowMemory;
}

// Process pages in parallel with concurrency limit
async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let completed = 0;
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await processor(items[index], index);
      completed++;
      onProgress?.(completed, items.length);
    }
  }

  // Start concurrent workers
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
  return results;
}

export async function pdfToImages(
  file: File,
  options: {
    format?: "png" | "jpeg";
    quality?: number;
    scale?: number;
    pageNumbers?: number[]; // Specific pages to convert (1-indexed)
    rotations?: Record<number, 0 | 90 | 180 | 270>; // Page number -> rotation
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<ConvertedImage[]> {
  const isLowEnd = isLowEndDevice();

  // Auto-adjust scale for low-end devices
  const defaultScale = isLowEnd ? 1.5 : 2;
  const { format = "png", quality = 0.92, scale = defaultScale, pageNumbers: selectedPages, rotations = {}, onProgress } = options;

  // Concurrency: 2 for low-end, 4 for high-end
  const concurrency = isLowEnd ? 2 : 4;

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  // Use selected pages or all pages
  const pageNumbers = selectedPages
    ? selectedPages.filter(p => p >= 1 && p <= totalPages)
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  const images = await processInParallel(
    pageNumbers,
    async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const rotation = rotations[pageNum] || 0;

      // Include rotation in viewport
      const viewport = page.getViewport({ scale, rotation });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext("2d")!;
      await page.render({ canvasContext: context, viewport }).promise;

      // Create blob first (needed for download)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mimeType, quality);
      });

      // Use blob URL for preview instead of dataUrl (much faster)
      const dataUrl = URL.createObjectURL(blob);

      // Clean up canvas to free memory
      canvas.width = 0;
      canvas.height = 0;

      return {
        pageNumber: pageNum,
        dataUrl,
        blob,
      };
    },
    concurrency,
    onProgress
  );

  return images;
}

// Prepared image data for PDF embedding
interface PreparedImage {
  bytes: Uint8Array;
  type: "png" | "jpeg";
  index: number;
}

// Rotate image using canvas
async function rotateImageBytes(
  bytes: Uint8Array,
  type: "png" | "jpeg",
  rotation: number
): Promise<{ bytes: Uint8Array; type: "png" | "jpeg" }> {
  if (rotation === 0) return { bytes, type };

  const mimeType = type === "png" ? "image/png" : "image/jpeg";
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Swap dimensions for 90/270 rotation
      if (rotation === 90 || rotation === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Move to center, rotate, draw
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob(
        async (rotatedBlob) => {
          const arrayBuffer = await rotatedBlob!.arrayBuffer();
          resolve({ bytes: new Uint8Array(arrayBuffer), type: "jpeg" });
        },
        "image/jpeg",
        0.92
      );
    };
    img.src = url;
  });
}

export async function imagesToPdf(
  files: File[],
  options: {
    pageSize?: "a4" | "letter" | "fit";
    margin?: number;
    rotations?: number[]; // Per-image rotation in degrees (0, 90, 180, 270)
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<Uint8Array> {
  const { pageSize = "a4", margin = 20, rotations = [], onProgress } = options;
  const isLowEnd = isLowEndDevice();
  const concurrency = isLowEnd ? 2 : 4;

  // Page dimensions in points (72 points = 1 inch)
  const sizes = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 },
    fit: null as { width: number; height: number } | null,
  };

  // Step 1: Prepare all images in parallel (load + convert + rotate)
  const preparedImages = await processInParallel(
    files.map((f, i) => ({ file: f, index: i })),
    async ({ file, index }) => {
      const fileType = file.type.toLowerCase();
      let bytes: Uint8Array;
      let type: "png" | "jpeg";

      if (fileType === "image/png") {
        bytes = new Uint8Array(await file.arrayBuffer());
        type = "png";
      } else if (fileType === "image/jpeg" || fileType === "image/jpg") {
        bytes = new Uint8Array(await file.arrayBuffer());
        type = "jpeg";
      } else {
        // Convert other formats to JPEG
        const dataUrl = await fileToDataUrl(file);
        bytes = await dataUrlToJpegBytes(dataUrl);
        type = "jpeg";
      }

      // Apply rotation if specified
      const rotation = rotations[index] || 0;
      if (rotation !== 0) {
        const rotated = await rotateImageBytes(bytes, type, rotation);
        bytes = rotated.bytes;
        type = rotated.type;
      }

      return { bytes, type, index } as PreparedImage;
    },
    concurrency,
    (completed, total) => onProgress?.(Math.round(completed * 0.5), total) // 0-50% progress
  );

  // Sort by original index to maintain order
  preparedImages.sort((a, b) => a.index - b.index);

  // Step 2: Build PDF sequentially (required for page order)
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < preparedImages.length; i++) {
    const { bytes, type } = preparedImages[i];

    const image = type === "png"
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);

    const imgWidth = image.width;
    const imgHeight = image.height;

    let pageWidth: number;
    let pageHeight: number;

    if (pageSize === "fit") {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      const size = sizes[pageSize]!;
      pageWidth = size.width;
      pageHeight = size.height;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    let drawWidth = imgWidth;
    let drawHeight = imgHeight;

    if (drawWidth > maxWidth || drawHeight > maxHeight) {
      const scaleX = maxWidth / drawWidth;
      const scaleY = maxHeight / drawHeight;
      const scale = Math.min(scaleX, scaleY);
      drawWidth *= scale;
      drawHeight *= scale;
    }

    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });

    onProgress?.(Math.round(50 + ((i + 1) / preparedImages.length) * 50), files.length); // 50-100%
  }

  return pdfDoc.save();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function dataUrlToJpegBytes(dataUrl: string): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        async (blob) => {
          const arrayBuffer = await blob!.arrayBuffer();
          resolve(new Uint8Array(arrayBuffer));
        },
        "image/jpeg",
        0.92
      );
    };
    img.src = dataUrl;
  });
}

export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadImagesAsZip(
  images: ConvertedImage[],
  baseName: string,
  format: "png" | "jpeg"
) {
  // Download each image individually since we're avoiding additional dependencies
  const ext = format === "png" ? "png" : "jpg";
  images.forEach((img, index) => {
    setTimeout(() => {
      downloadImage(img.blob, `${baseName}_page${img.pageNumber}.${ext}`);
    }, index * 100);
  });
}

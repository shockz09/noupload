import Tesseract from "tesseract.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pdfToImages, ConvertedImage } from "./pdf-image-utils";

export interface OCRWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OCRPageResult {
  pageNumber: number;
  words: OCRWord[];
  imageWidth: number;
  imageHeight: number;
}

interface CreateSearchablePDFOptions {
  language?: string;
  scale?: number;
  confidenceThreshold?: number;
  onProgress?: (percent: number, status: string) => void;
}

/**
 * Creates a searchable PDF from a scanned PDF or image.
 * The result looks identical to the original but has invisible text layer
 * that makes it selectable and searchable.
 */
export async function createSearchablePDF(
  file: File,
  options: CreateSearchablePDFOptions = {}
): Promise<Uint8Array> {
  const {
    language = "eng",
    scale = 3, // Higher resolution for better OCR accuracy
    confidenceThreshold = 60,
    onProgress,
  } = options;

  // Stage 1: Convert PDF to images (0-25%)
  onProgress?.(0, "Converting PDF pages to images...");

  let images: (ConvertedImage & { width: number; height: number })[] = [];

  if (file.type === "application/pdf") {
    const converted = await pdfToImages(file, {
      scale,
      format: "png",
      onProgress: (current, total) => {
        const percent = Math.round((current / total) * 25);
        onProgress?.(percent, `Converting page ${current} of ${total}...`);
      },
    });

    // Get dimensions for each image
    images = await Promise.all(
      converted.map(async (img) => {
        const dimensions = await getImageDimensions(img.dataUrl);
        return { ...img, ...dimensions };
      })
    );
  } else {
    // Single image file
    const dataUrl = await fileToDataUrl(file);
    const dimensions = await getImageDimensions(dataUrl);
    const blob = file;
    images = [{
      pageNumber: 1,
      dataUrl,
      blob,
      width: dimensions.width,
      height: dimensions.height,
    }];
  }

  // Stage 2: Run OCR on each page (25-75%)
  // Create ONE worker and reuse it for all pages (loads language data only once)
  onProgress?.(25, "Loading OCR engine...");
  const worker = await Tesseract.createWorker(language, 1);

  const ocrResults: OCRPageResult[] = [];

  try {
    for (let i = 0; i < images.length; i++) {
      const progressBase = 25 + (i / images.length) * 50;
      onProgress?.(Math.round(progressBase), `Running OCR on page ${i + 1} of ${images.length}...`);

      const words = await extractOCRWordsWithWorker(worker, images[i].blob);

      ocrResults.push({
        pageNumber: i + 1,
        words,
        imageWidth: images[i].width,
        imageHeight: images[i].height,
      });
    }
  } finally {
    // Always terminate worker when done
    await worker.terminate();
  }

  // Stage 3: Create PDF with invisible text layer (75-100%)
  onProgress?.(75, "Creating searchable PDF...");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const ocrResult = ocrResults[i];

    onProgress?.(Math.round(75 + ((i + 1) / images.length) * 25), `Adding text layer to page ${i + 1}...`);

    // Image was rendered at given scale (default 2x = 144 DPI)
    // PDF uses 72 DPI, so divide pixel dimensions by scale
    const pageWidth = image.width / scale;
    const pageHeight = image.height / scale;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Embed and draw the image as background
    const imageBytes = await blobToArrayBuffer(image.blob);
    const pdfImage = await pdfDoc.embedPng(imageBytes);

    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    // Scale factor: convert Tesseract pixel coords to PDF points
    const scaleFactor = 1 / scale;

    for (const word of ocrResult.words) {
      if (word.confidence < confidenceThreshold) {
        continue;
      }
      if (!word.text.trim()) continue;

      // Tesseract bbox is in image pixels (top-left origin)
      // PDF is in points (bottom-left origin)
      const wordLeft = word.bbox.x0 * scaleFactor;
      const wordRight = word.bbox.x1 * scaleFactor;
      const wordBottom = word.bbox.y1 * scaleFactor;

      const wordWidth = wordRight - wordLeft;
      const wordHeight = (word.bbox.y1 - word.bbox.y0) * scaleFactor;

      // PDF text is positioned by baseline, not bounding box bottom
      // Baseline is typically 15-25% above the bottom edge (descenders below)
      const baselineOffset = wordHeight * 0.20;

      const x = wordLeft;
      const y = pageHeight - wordBottom + baselineOffset;

      // Calculate font size more accurately
      // Helvetica cap height is ~72% of font size
      let fontSize = wordHeight / 0.72;

      // Shrink to fit width if needed
      const measuredWidth = font.widthOfTextAtSize(word.text, fontSize);
      if (measuredWidth > wordWidth && measuredWidth > 0) {
        fontSize = fontSize * (wordWidth / measuredWidth);
      }

      fontSize = Math.max(4, Math.min(72, fontSize));

      // Draw invisible text layer
      page.drawText(word.text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        opacity: 0.001, // Nearly invisible
      });
    }
  }

  onProgress?.(100, "Complete!");
  return pdfDoc.save();
}

/**
 * Extract words with bounding boxes using an existing Tesseract worker
 */
async function extractOCRWordsWithWorker(
  worker: Tesseract.Worker,
  imageBlob: Blob
): Promise<OCRWord[]> {
  // Request blocks output which includes word bounding boxes
  const result = await worker.recognize(imageBlob, {}, { blocks: true, text: true, hocr: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;

  const words: OCRWord[] = [];

  // Parse HOCR to extract word bounding boxes
  if (data.hocr) {
    const wordRegex = /<span class='ocrx_word'[^>]*title='bbox (\d+) (\d+) (\d+) (\d+); x_wconf (\d+)'[^>]*>([^<]+)<\/span>/g;
    let match;
    while ((match = wordRegex.exec(data.hocr)) !== null) {
      const [, x0, y0, x1, y1, conf, text] = match;
      words.push({
        text: text.trim(),
        bbox: {
          x0: parseInt(x0),
          y0: parseInt(y0),
          x1: parseInt(x1),
          y1: parseInt(y1),
        },
        confidence: parseInt(conf),
      });
    }
  }

  return words;
}

/**
 * Get image dimensions from a data URL
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.src = dataUrl;
  });
}

/**
 * Convert a File to a data URL
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a Blob to ArrayBuffer
 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

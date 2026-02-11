import type { PDFImage } from "pdf-lib";

// Lazy load pdf-lib (~23MB) - cached after first import
let pdfLibCache: typeof import("pdf-lib") | null = null;
const getPdfLib = async () => {
  if (!pdfLibCache) {
    pdfLibCache = await import("pdf-lib");
  }
  return pdfLibCache;
};

export async function mergePDFs(files: File[]): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return mergedPdf.save();
}

export async function splitPDF(file: File, ranges: { start: number; end: number }[]): Promise<Uint8Array[]> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const results: Uint8Array[] = [];

  for (const range of ranges) {
    const newPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let i = range.start; i <= range.end && i < pdf.getPageCount(); i++) {
      pageIndices.push(i);
    }
    const copiedPages = await newPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    results.push(await newPdf.save());
  }

  return results;
}

export async function extractPages(file: File, pageNumbers: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const validIndices = pageNumbers
    .map((n) => n - 1) // Convert to 0-indexed
    .filter((i) => i >= 0 && i < pdf.getPageCount());

  const copiedPages = await newPdf.copyPages(pdf, validIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  return newPdf.save();
}

export async function extractPagesWithRotation(
  file: File,
  pageSpecs: { pageNumber: number; rotation: 0 | 90 | 180 | 270 }[],
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  const totalPages = pdf.getPageCount();

  for (const spec of pageSpecs) {
    const index = spec.pageNumber - 1;
    if (index < 0 || index >= totalPages) continue;

    const [copiedPage] = await newPdf.copyPages(pdf, [index]);
    if (spec.rotation !== 0) {
      const currentRotation = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRotation + spec.rotation) % 360));
    }
    newPdf.addPage(copiedPage);
  }

  return newPdf.save();
}

export async function organizePDF(
  file: File,
  pageOrder: number[], // 1-indexed page numbers in desired order
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  // Convert to 0-indexed and filter valid indices
  const validIndices = pageOrder.map((n) => n - 1).filter((i) => i >= 0 && i < pdf.getPageCount());

  const copiedPages = await newPdf.copyPages(pdf, validIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  return newPdf.save();
}

export async function rotatePDF(
  file: File,
  rotation: 0 | 90 | 180 | 270,
  pageNumbers?: number[], // If undefined, rotate all pages
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();

  const indicesToRotate = pageNumbers
    ? pageNumbers.map((n) => n - 1).filter((i) => i >= 0 && i < pages.length)
    : pages.map((_, i) => i);

  indicesToRotate.forEach((index) => {
    const page = pages[index];
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + rotation) % 360));
  });

  return pdf.save();
}

export async function addWatermark(
  file: File,
  text: string,
  options: {
    fontSize?: number;
    opacity?: number;
    rotation?: number;
    x?: number; // 0-100 percentage from left
    y?: number; // 0-100 percentage from bottom
  } = {},
): Promise<Uint8Array> {
  const { fontSize = 50, opacity = 0.3, rotation = -45, x = 50, y = 50 } = options;

  const { PDFDocument, degrees } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    // Convert percentage to actual coordinates
    const actualX = (x / 100) * width - (text.length * fontSize) / 4;
    const actualY = (y / 100) * height;
    page.drawText(text, {
      x: actualX,
      y: actualY,
      size: fontSize,
      opacity,
      rotate: degrees(rotation),
    });
  }

  return pdf.save();
}

export async function addPageNumbers(
  file: File,
  options: {
    fontSize?: number;
    startFrom?: number;
    format?: string; // e.g., "Page {n} of {total}"
    x?: number; // 0-100 percentage from left
    y?: number; // 0-100 percentage from bottom
  } = {},
): Promise<Uint8Array> {
  const { fontSize = 12, startFrom = 1, format = "{n}", x = 50, y = 5 } = options;

  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const totalPages = pages.length;

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const pageNum = index + startFrom;
    const text = format.replace("{n}", pageNum.toString()).replace("{total}", totalPages.toString());

    // Convert percentage to actual coordinates
    const actualX = (x / 100) * width - (text.length * fontSize) / 4;
    const actualY = (y / 100) * height;

    page.drawText(text, { x: actualX, y: actualY, size: fontSize });
  });

  return pdf.save();
}

export async function getPDFPageCount(file: File): Promise<number> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  return pdf.getPageCount();
}

export async function compressPDF(file: File): Promise<Uint8Array> {
  // Note: pdf-lib has limited compression capabilities
  // For better compression, you'd need a server-side solution
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);

  // Remove metadata to reduce size slightly
  pdf.setTitle("");
  pdf.setAuthor("");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setProducer("");
  pdf.setCreator("");

  return pdf.save({
    useObjectStreams: true, // Better compression
  });
}

export function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMultiple(files: { data: Uint8Array; filename: string }[]) {
  files.forEach(({ data, filename }, index) => {
    setTimeout(() => downloadBlob(data, filename), index * 100);
  });
}

export async function addSignature(
  file: File,
  signatureDataUrl: string,
  options: {
    x?: number; // 0-100 percentage from left
    y?: number; // 0-100 percentage from bottom
    width?: number; // width in points
    height?: number; // height in points
    pageNumbers?: number[]; // pages to sign (1-indexed), if undefined signs all
  } = {},
): Promise<Uint8Array> {
  const { x = 70, y = 10, width = 150, pageNumbers } = options;

  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();

  // Convert data URL to image
  const signatureBytes = await fetch(signatureDataUrl).then((res) => res.arrayBuffer());

  // Determine image type and embed
  let signatureImage: PDFImage;
  if (signatureDataUrl.includes("image/png")) {
    signatureImage = await pdf.embedPng(signatureBytes);
  } else {
    signatureImage = await pdf.embedJpg(signatureBytes);
  }

  // Calculate aspect ratio
  const aspectRatio = signatureImage.width / signatureImage.height;
  const finalWidth = width;
  const finalHeight = width / aspectRatio;

  // Determine which pages to sign
  const pagesToSign = pageNumbers
    ? pageNumbers.map((n) => n - 1).filter((i) => i >= 0 && i < pages.length)
    : pages.map((_, i) => i);

  for (const pageIndex of pagesToSign) {
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage to actual coordinates
    const actualX = (x / 100) * pageWidth - finalWidth / 2;
    const actualY = (y / 100) * pageHeight - finalHeight / 2;

    page.drawImage(signatureImage, {
      x: actualX,
      y: actualY,
      width: finalWidth,
      height: finalHeight,
    });
  }

  return pdf.save();
}

export async function sanitizePDF(file: File): Promise<{ data: Uint8Array; removedFields: string[] }> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const removedFields: string[] = [];

  // Get current metadata to report what was removed
  if (pdf.getTitle()) removedFields.push("Title");
  if (pdf.getAuthor()) removedFields.push("Author");
  if (pdf.getSubject()) removedFields.push("Subject");
  if (pdf.getKeywords()) removedFields.push("Keywords");
  if (pdf.getProducer()) removedFields.push("Producer");
  if (pdf.getCreator()) removedFields.push("Creator");
  if (pdf.getCreationDate()) removedFields.push("Creation Date");
  if (pdf.getModificationDate()) removedFields.push("Modification Date");

  // Remove all metadata
  pdf.setTitle("");
  pdf.setAuthor("");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setProducer("");
  pdf.setCreator("");

  return {
    data: await pdf.save(),
    removedFields,
  };
}

export async function reversePDF(file: File): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const pageCount = pdf.getPageCount();
  const reversedIndices = Array.from({ length: pageCount }, (_, i) => pageCount - 1 - i);

  const copiedPages = await newPdf.copyPages(pdf, reversedIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  return newPdf.save();
}

export async function duplicatePages(
  file: File,
  pageNumbers: number[], // 1-indexed pages to duplicate
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const totalPages = pdf.getPageCount();

  // Validate page numbers
  const validPages = pageNumbers.filter((n) => n >= 1 && n <= totalPages);
  if (validPages.length === 0) {
    throw new Error("No valid pages to duplicate");
  }

  // Copy and append each page
  const indicesToCopy = validPages.map((n) => n - 1);
  const copiedPages = await pdf.copyPages(pdf, indicesToCopy);
  copiedPages.forEach((page) => pdf.addPage(page));

  return pdf.save();
}

export async function deletePages(
  file: File,
  pageNumbers: number[], // 1-indexed pages to delete
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const totalPages = pdf.getPageCount();

  // Get pages to keep (inverse of pages to delete)
  const pagesToDelete = new Set(pageNumbers.map((n) => n - 1));
  const pagesToKeep = Array.from({ length: totalPages }, (_, i) => i).filter((i) => !pagesToDelete.has(i));

  if (pagesToKeep.length === 0) {
    throw new Error("Cannot delete all pages");
  }

  // Create new PDF with remaining pages
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
  copiedPages.forEach((page) => newPdf.addPage(page));

  return newPdf.save();
}

export async function getPDFMetadata(file: File): Promise<{
  title: string | undefined;
  author: string | undefined;
  subject: string | undefined;
  keywords: string | undefined;
  producer: string | undefined;
  creator: string | undefined;
  creationDate: Date | undefined;
  modificationDate: Date | undefined;
  pageCount: number;
}> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);

  return {
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    keywords: pdf.getKeywords(),
    producer: pdf.getProducer(),
    creator: pdf.getCreator(),
    creationDate: pdf.getCreationDate(),
    modificationDate: pdf.getModificationDate(),
    pageCount: pdf.getPageCount(),
  };
}

export async function setPDFMetadata(
  file: File,
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
  },
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);

  if (metadata.title !== undefined) pdf.setTitle(metadata.title);
  if (metadata.author !== undefined) pdf.setAuthor(metadata.author);
  if (metadata.subject !== undefined) pdf.setSubject(metadata.subject);
  if (metadata.keywords !== undefined) {
    pdf.setKeywords(
      metadata.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }
  if (metadata.creator !== undefined) pdf.setCreator(metadata.creator);

  return pdf.save();
}

export async function extractImagesFromPDF(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<{ images: Blob[]; names: string[] }> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);

  const images: Blob[] = [];
  const names: string[] = [];
  const pages = pdf.getPages();

  // Access the internal document structure to find images
  const pdfDoc = pdf.context;
  const imageRefs: Set<string> = new Set();

  // Collect all XObject image references
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const resources = page.node.Resources();
    if (!resources) continue;

    const xObjects = resources.get(pdfDoc.obj("XObject"));
    if (!xObjects) continue;

    const xObjectDict = pdfDoc.lookup(xObjects);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dictAny = xObjectDict as any;
    if (!xObjectDict || typeof dictAny.entries !== "function") continue;

    for (const [, ref] of dictAny.entries()) {
      const xObject = pdfDoc.lookup(ref);
      if (!xObject) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const xObjAny = xObject as any;
      const subtype = xObjAny.get?.(pdfDoc.obj("Subtype"));
      if (subtype && subtype.toString() === "/Image") {
        const refStr = ref.toString();
        if (!imageRefs.has(refStr)) {
          imageRefs.add(refStr);

          try {
            // Get image data
            const filter = xObjAny.get?.(pdfDoc.obj("Filter"));

            // Get stream data
            const stream = xObjAny.getContents ? xObjAny.getContents() : null;
            if (!stream) continue;

            // Determine image type and create blob
            let mimeType = "image/png";
            if (filter) {
              const filterStr = filter.toString();
              if (filterStr.includes("DCTDecode")) {
                mimeType = "image/jpeg";
              } else if (filterStr.includes("JPXDecode")) {
                mimeType = "image/jp2";
              }
            }

            const blob = new Blob([stream], { type: mimeType });
            images.push(blob);
            const ext = mimeType === "image/jpeg" ? "jpg" : "png";
            names.push(`image_${images.length}.${ext}`);
          } catch {
            // Skip problematic images
          }
        }
      }
    }

    onProgress?.(pageIdx + 1, pages.length);
  }

  return { images, names };
}

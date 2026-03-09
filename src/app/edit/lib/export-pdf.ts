"use client";

import type { FormField } from "../hooks/useFormFields";
import type { EditorObjectRecord, EditorTextRecord } from "./editor-objects";
import { loadFabricModule, recordToFabricObject } from "./editor-objects";
import { loadLibPdf } from "./libpdf";
import { canDrawTextNatively, pickNativePdfFont } from "./text-export-policy";
import type { PageState } from "../page";

export interface ExportOptions {
  file: File;
  pageStates: PageState[];
  pageObjects: Map<number, EditorObjectRecord[]>;
  formFields: FormField[];
}

interface OverlayResult {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function exportPdf({ file, pageStates, pageObjects, formFields }: ExportOptions): Promise<Uint8Array> {
  const [{ PDF, StandardFonts, rgb }, fileBytes] = await Promise.all([loadLibPdf(), file.arrayBuffer()]);
  const pdf = await PDF.load(new Uint8Array(fileBytes));
  const form = pdf.getForm();
  const hasSignatureFields = !!form?.getSignatureFields().length;

  if (form) {
    const values = buildFormFillValues(formFields);
    if (Object.keys(values).length > 0) {
      form.fill(values);
    }
    form.flatten({ skipSignatures: true });
  }

  const pages = pdf.getPages();
  const pagesToDelete: number[] = [];

  for (let index = 0; index < pages.length; index++) {
    const pageNumber = index + 1;
    const page = pages[index];
    const pageState = pageStates.find((item) => item.pageNumber === pageNumber);

    if (pageState?.deleted) {
      pagesToDelete.push(index);
      continue;
    }

    if (pageState?.rotation) {
      const nextRotation = (((page.rotation || 0) + pageState.rotation) % 360) as 0 | 90 | 180 | 270;
      page.setRotation(nextRotation);
    }

    const records = (pageObjects.get(pageNumber) || []).slice().sort((a, b) => a.zIndex - b.zIndex);
    for (const record of records) {
      await drawRecord({
        page,
        pageWidth: page.width,
        pageHeight: page.height,
        pdf,
        record,
        rgb,
        StandardFonts,
      });
    }
  }

  pagesToDelete.sort((a, b) => b - a);
  for (const pageIndex of pagesToDelete) {
    pdf.removePage(pageIndex);
  }

  const canSaveIncrementally = hasSignatureFields && pdf.canSaveIncrementally() === null;
  return pdf.save({ incremental: canSaveIncrementally });
}

async function drawRecord({
  page,
  pageWidth,
  pageHeight,
  pdf,
  record,
  rgb,
  StandardFonts,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any;
  pageWidth: number;
  pageHeight: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any;
  record: EditorObjectRecord;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any;
  StandardFonts: Record<string, string>;
}): Promise<void> {
  switch (record.kind) {
    case "rectangle":
    case "highlight":
    case "whiteout":
    case "redaction":
      drawRectangleRecord(page, pageHeight, record, rgb);
      return;
    case "ellipse":
      drawEllipseRecord(page, pageHeight, record, rgb);
      return;
    case "line":
      drawLineRecord(page, pageHeight, record, rgb);
      return;
    case "arrow":
      drawArrowRecord(page, pageHeight, record, rgb);
      return;
    case "image":
    case "signature":
      await drawNativeImageRecord(pdf, page, pageHeight, record);
      return;
    case "text":
    case "editedText":
      if (canDrawTextNatively(record, StandardFonts)) {
        drawTextRecord(page, pageHeight, record, rgb, StandardFonts);
      } else {
        await drawOverlayRecord(pdf, page, pageHeight, record, pageWidth, pageHeight);
      }
      return;
    case "path":
    case "stamp":
    case "unsupported":
      await drawOverlayRecord(pdf, page, pageHeight, record, pageWidth, pageHeight);
      return;
    default:
      return;
  }
}

function buildFormFillValues(formFields: FormField[]): Record<string, boolean | string> {
  const values: Record<string, boolean | string> = {};
  for (const field of formFields) {
    if (!field.name || !field.value) continue;

    if (field.type === "checkbox") {
      values[field.name] = field.value === "true" || field.value === "Yes";
      continue;
    }

    if (field.type === "radio" || field.type === "select" || field.type === "text") {
      values[field.name] = field.value;
    }
  }
  return values;
}

function drawRectangleRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: Extract<EditorObjectRecord, { kind: "rectangle" | "highlight" | "whiteout" | "redaction" }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any,
) {
  const fillColor =
    record.kind === "redaction" ? "#000000" : record.kind === "whiteout" ? "#FFFFFF" : record.style.fill || record.style.stroke;
  page.drawRectangle({
    x: record.x,
    y: pageHeight - record.y - record.height,
    width: record.width,
    height: record.height,
    color: hexToRgb(fillColor, rgb),
    borderColor: record.kind === "rectangle" ? hexToRgb(record.style.stroke, rgb) : undefined,
    borderWidth: record.kind === "rectangle" ? record.style.strokeWidth || 0 : 0,
    opacity: record.kind === "highlight" ? record.style.opacity ?? 0.4 : record.style.opacity ?? 1,
    rotate: record.rotation ? { angle: -record.rotation, origin: "center" } : undefined,
  });
}

function drawEllipseRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: Extract<EditorObjectRecord, { kind: "ellipse" }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any,
) {
  page.drawEllipse({
    x: record.x + record.width / 2,
    y: pageHeight - record.y - record.height / 2,
    xRadius: record.width / 2,
    yRadius: record.height / 2,
    color: hexToRgb(record.style.fill, rgb),
    borderColor: hexToRgb(record.style.stroke, rgb),
    borderWidth: record.style.strokeWidth || 0,
    opacity: record.style.opacity ?? 1,
    borderOpacity: record.style.opacity ?? 1,
    rotate: record.rotation ? { angle: -record.rotation, origin: "center" } : undefined,
  });
}

function drawLineRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: { x1: number; y1: number; x2: number; y2: number; style: EditorObjectRecord["style"] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any,
) {
  page.drawLine({
    start: {
      x: record.x1,
      y: pageHeight - record.y1,
    },
    end: {
      x: record.x2,
      y: pageHeight - record.y2,
    },
    color: hexToRgb(record.style.stroke, rgb),
    thickness: record.style.strokeWidth || 2,
    opacity: record.style.opacity ?? 1,
    lineCap: "round",
  });
}

function drawArrowRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: { x1: number; y1: number; x2: number; y2: number; style: EditorObjectRecord["style"] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any,
) {
  drawLineRecord(page, pageHeight, record, rgb);

  const strokeWidth = record.style.strokeWidth || 2;
  const angle = Math.atan2(record.y2 - record.y1, record.x2 - record.x1);
  const headLength = Math.max(strokeWidth * 5, 12);
  const pdfEndX = record.x2;
  const pdfEndY = pageHeight - record.y2;
  const leftPoint = {
    x: pdfEndX - headLength * Math.cos(angle - Math.PI / 6),
    y: pdfEndY + headLength * Math.sin(angle - Math.PI / 6),
  };
  const rightPoint = {
    x: pdfEndX - headLength * Math.cos(angle + Math.PI / 6),
    y: pdfEndY + headLength * Math.sin(angle + Math.PI / 6),
  };

  page.drawLine({
    start: { x: pdfEndX, y: pdfEndY },
    end: leftPoint,
    color: hexToRgb(record.style.stroke, rgb),
    thickness: strokeWidth,
    opacity: record.style.opacity ?? 1,
    lineCap: "round",
  });
  page.drawLine({
    start: { x: pdfEndX, y: pdfEndY },
    end: rightPoint,
    color: hexToRgb(record.style.stroke, rgb),
    thickness: strokeWidth,
    opacity: record.style.opacity ?? 1,
    lineCap: "round",
  });
}

async function drawNativeImageRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: Extract<EditorObjectRecord, { kind: "image" | "signature" }>,
) {
  if (!record.asset.dataUrl) return;
  const bytes = dataUrlToBytes(record.asset.dataUrl);
  const image = record.asset.mimeType.includes("jpeg") || record.asset.mimeType.includes("jpg")
    ? pdf.embedJpeg(bytes)
    : pdf.embedPng(bytes);

  page.drawImage(image, {
    x: record.x,
    y: pageHeight - record.y - record.height,
    width: record.width,
    height: record.height,
    opacity: record.style.opacity ?? 1,
    rotate: record.rotation ? { angle: -record.rotation, origin: "center" } : undefined,
  });
}

function drawTextRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: EditorTextRecord,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any,
  StandardFonts: Record<string, string>,
) {
  const size = record.style.fontSize || 16;
  const font = pickNativePdfFont(record, StandardFonts);
  if (!font) return;

  const x = record.x;
  const y = pageHeight - record.y - size;
  const color = hexToRgb(record.style.fill || record.style.stroke, rgb);

  page.drawText(record.text, {
    x,
    y,
    font,
    size,
    color,
    opacity: record.style.opacity ?? 1,
    maxWidth: record.width,
  });

  const estimatedWidth = record.width || Math.max(record.text.length * size * 0.55, size);
  if (record.style.underline) {
    page.drawLine({
      start: { x, y: y - size * 0.08 },
      end: { x: x + estimatedWidth, y: y - size * 0.08 },
      color,
      thickness: Math.max(size * 0.05, 1),
      opacity: record.style.opacity ?? 1,
    });
  }
  if (record.style.linethrough) {
    page.drawLine({
      start: { x, y: y + size * 0.32 },
      end: { x: x + estimatedWidth, y: y + size * 0.32 },
      color,
      thickness: Math.max(size * 0.05, 1),
      opacity: record.style.opacity ?? 1,
    });
  }
}

async function drawOverlayRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  record: EditorObjectRecord,
  pageWidth: number,
  _pageHeight: number,
) {
  const overlay = await buildOverlay(record, pageWidth, _pageHeight);
  if (!overlay?.dataUrl) return;

  const image = pdf.embedPng(dataUrlToBytes(overlay.dataUrl));
  page.drawImage(image, {
    x: overlay.x,
    y: pageHeight - overlay.y - overlay.height,
    width: overlay.width,
    height: overlay.height,
    opacity: 1,
  });
}

async function buildOverlay(record: EditorObjectRecord, pageWidth: number, pageHeight: number): Promise<OverlayResult | null> {
  if ((record.kind === "stamp" || record.kind === "unsupported") && record.asset?.dataUrl && "x" in record && "y" in record) {
    return {
      dataUrl: record.asset.dataUrl,
      x: record.x,
      y: record.y,
      width: "width" in record ? record.width : 0,
      height: "height" in record ? record.height : 0,
    };
  }

  const { Canvas } = await loadFabricModule();
  const canvasEl = document.createElement("canvas");
  canvasEl.width = Math.ceil(pageWidth);
  canvasEl.height = Math.ceil(pageHeight);

  const canvas = new Canvas(canvasEl, {
    width: pageWidth,
    height: pageHeight,
    selection: false,
    renderOnAddRemove: false,
  });

  try {
    const fabricObj = await recordToFabricObject(record, 1);
    canvas.add(fabricObj);
    canvas.renderAll();

    const bounds = fabricObj.getBoundingRect();
    if (!bounds.width || !bounds.height) {
      return null;
    }

    const dataUrl = canvas.toDataURL({
      format: "png",
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      multiplier: 2,
    });

    return {
      dataUrl,
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  } finally {
    canvas.dispose();
  }
}

function hexToRgb(
  value: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rgb: any,
) {
  if (!value || value === "transparent") return undefined;

  const normalized = value.replace("#", "");
  if (normalized.length !== 3 && normalized.length !== 6) return undefined;

  const hex = normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized;
  const parsed = Number.parseInt(hex, 16);
  if (Number.isNaN(parsed)) return undefined;

  return rgb(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function countRedactions(pageObjects: Map<number, EditorObjectRecord[]>): number {
  let count = 0;
  for (const objects of pageObjects.values()) {
    for (const object of objects) {
      if (object.kind === "redaction") {
        count++;
      }
    }
  }
  return count;
}

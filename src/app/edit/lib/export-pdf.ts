"use client";

import { degrees, PDFDocument } from "pdf-lib";
import type { FormField } from "../hooks/useFormFields";
import type { PageState } from "../page";

// Must match the PDF_SCALE in EditorCanvas
const PDF_SCALE = 1.5;

export interface ExportOptions {
  file: File;
  pageStates: PageState[];
  pageObjects: Map<number, object[]>;
  formFields: FormField[];
}

/**
 * Export the edited PDF with annotations flattened
 */
export async function exportPdf({ file, pageStates, pageObjects, formFields }: ExportOptions): Promise<Uint8Array> {
  // Load original PDF
  const fileBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(fileBytes);

  // Fill form fields if any
  if (formFields.length > 0) {
    try {
      const form = pdfDoc.getForm();
      for (const field of formFields) {
        if (!field.value) continue;

        try {
          switch (field.type) {
            case "text": {
              const textField = form.getTextField(field.name);
              textField.setText(field.value);
              break;
            }
            case "checkbox": {
              const checkBox = form.getCheckBox(field.name);
              if (field.value === "true" || field.value === "Yes") {
                checkBox.check();
              } else {
                checkBox.uncheck();
              }
              break;
            }
            case "radio": {
              const radioGroup = form.getRadioGroup(field.name);
              radioGroup.select(field.value);
              break;
            }
            case "select": {
              const dropdown = form.getDropdown(field.name);
              dropdown.select(field.value);
              break;
            }
          }
        } catch (fieldErr) {
          console.warn(`Failed to fill field "${field.name}":`, fieldErr);
        }
      }
      // Flatten form to make fields non-editable in output
      form.flatten();
    } catch (formErr) {
      console.warn("Failed to process form fields:", formErr);
    }
  }

  // Get pages in order
  const pages = pdfDoc.getPages();

  // Track which pages to delete (from highest to lowest index to avoid shifting)
  const pagesToDelete: number[] = [];

  // Process each page
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const pageState = pageStates.find((p) => p.pageNumber === pageNum);
    const page = pages[i];

    // Mark deleted pages
    if (pageState?.deleted) {
      pagesToDelete.push(i);
      continue;
    }

    // Apply rotation
    if (pageState?.rotation) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + pageState.rotation));
    }

    // Get annotations for this page
    const objects = pageObjects.get(pageNum);
    if (!objects || objects.length === 0) continue;

    // Render Fabric objects to image and embed
    try {
      const pngDataUrl = await renderObjectsToImage(objects, page.getWidth(), page.getHeight());
      if (pngDataUrl) {
        const pngImageBytes = dataUrlToBytes(pngDataUrl);
        const pngImage = await pdfDoc.embedPng(pngImageBytes);
        const { width, height } = page.getSize();

        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }
    } catch (err) {
      console.error(`Failed to render annotations for page ${pageNum}:`, err);
    }
  }

  // Remove deleted pages (in reverse order to maintain indices)
  pagesToDelete.sort((a, b) => b - a);
  for (const pageIndex of pagesToDelete) {
    pdfDoc.removePage(pageIndex);
  }

  // Save and return
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Render Fabric.js objects to a PNG data URL
 */
async function renderObjectsToImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objects: any[],
  pdfWidth: number,
  pdfHeight: number,
): Promise<string | null> {
  if (objects.length === 0) return null;

  // Create offscreen canvas
  const fabric = await import("fabric");
  const { Canvas, util } = fabric;

  // Export at higher resolution for better quality
  const scale = 2;

  const canvasEl = document.createElement("canvas");
  canvasEl.width = pdfWidth * scale;
  canvasEl.height = pdfHeight * scale;

  const canvas = new Canvas(canvasEl, {
    width: pdfWidth * scale,
    height: pdfHeight * scale,
    renderOnAddRemove: false,
  });

  // Load and add each object, scaling appropriately
  for (const objData of objects) {
    try {
      // Check if this is a redaction object (convert pattern to solid black)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isRedaction = objData.stroke === "#FF0000" && objData.opacity === 0.5;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modifiedData: any = { ...objData };

      if (isRedaction) {
        // Convert redaction to solid black rectangle
        modifiedData.fill = "#000000";
        modifiedData.stroke = "#000000";
        modifiedData.opacity = 1;
      }

      // Scale up the object coordinates for export
      // The editor canvas is at displayWidth = pdfWidth/PDF_SCALE
      // We need to scale from display coords to PDF coords, then to export scale
      const displayScale = PDF_SCALE;
      const totalScale = displayScale * scale;

      modifiedData.left = (modifiedData.left || 0) * totalScale;
      modifiedData.top = (modifiedData.top || 0) * totalScale;
      modifiedData.scaleX = (modifiedData.scaleX || 1) * totalScale;
      modifiedData.scaleY = (modifiedData.scaleY || 1) * totalScale;

      // Scale stroke width
      if (modifiedData.strokeWidth) {
        modifiedData.strokeWidth *= totalScale;
      }

      // Handle line objects
      if (modifiedData.type === "line") {
        modifiedData.x1 = (modifiedData.x1 || 0) * totalScale;
        modifiedData.y1 = (modifiedData.y1 || 0) * totalScale;
        modifiedData.x2 = (modifiedData.x2 || 0) * totalScale;
        modifiedData.y2 = (modifiedData.y2 || 0) * totalScale;
      }

      // Handle polygon points (for arrows)
      if (modifiedData.points) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modifiedData.points = modifiedData.points.map((p: any) => ({
          x: p.x * totalScale,
          y: p.y * totalScale,
        }));
      }

      // Handle font size for text
      if (modifiedData.fontSize) {
        modifiedData.fontSize *= totalScale;
      }
      if (modifiedData.width && modifiedData.type === "textbox") {
        modifiedData.width *= totalScale;
      }

      const [fabricObj] = await util.enlivenObjects([modifiedData]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.add(fabricObj as any);
    } catch (err) {
      console.error("Failed to recreate object for export:", err);
    }
  }

  canvas.renderAll();

  // Export to PNG
  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: 1, // Already scaled
  });

  // Cleanup
  canvas.dispose();

  return dataUrl;
}

/**
 * Convert data URL to Uint8Array
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Count redactions in page objects
 */
export function countRedactions(pageObjects: Map<number, object[]>): number {
  let count = 0;
  for (const objects of pageObjects.values()) {
    for (const obj of objects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyObj = obj as any;
      if (anyObj.stroke === "#FF0000" && anyObj.opacity === 0.5) {
        count++;
      }
    }
  }
  return count;
}

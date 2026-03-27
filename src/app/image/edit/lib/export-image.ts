import type {
  EditorEllipseRecord,
  EditorImageRecord,
  EditorLineRecord,
  EditorObjectRecord,
  EditorPathRecord,
  EditorRectangleRecord,
  EditorStampRecord,
  EditorTextRecord,
} from "@/app/edit/lib/editor-objects";

export interface ExportImageOptions {
  sourceFile: File;
  objects: EditorObjectRecord[];
  outputFormat: "png" | "jpeg" | "webp";
  outputQuality: number;
}

export interface ExportImageResult {
  blob: Blob;
  width: number;
  height: number;
}

const FORMAT_MIME: Record<ExportImageOptions["outputFormat"], string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function exportImage(options: ExportImageOptions): Promise<ExportImageResult> {
  const { sourceFile, objects, outputFormat, outputQuality } = options;

  const baseImage = await loadImageFromFile(sourceFile);
  const { naturalWidth, naturalHeight } = baseImage;

  const canvas = document.createElement("canvas");
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas 2D context");
  }

  ctx.drawImage(baseImage, 0, 0, naturalWidth, naturalHeight);

  if (objects.length === 0) {
    const blob = await canvasToBlob(canvas, FORMAT_MIME[outputFormat], outputQuality);
    return { blob, width: naturalWidth, height: naturalHeight };
  }

  const sorted = objects.slice().sort((a, b) => a.zIndex - b.zIndex);
  const assetImages = await preloadAssetImages(sorted);

  for (const record of sorted) {
    drawRecord(ctx, record, assetImages);
  }

  const blob = await canvasToBlob(canvas, FORMAT_MIME[outputFormat], outputQuality);
  return { blob, width: naturalWidth, height: naturalHeight };
}

// ---------------------------------------------------------------------------
// Drawing dispatcher
// ---------------------------------------------------------------------------

function drawRecord(
  ctx: CanvasRenderingContext2D,
  record: EditorObjectRecord,
  assetImages: Map<string, HTMLImageElement>,
): void {
  switch (record.kind) {
    case "rectangle":
      drawRectangle(ctx, record);
      return;
    case "ellipse":
      drawEllipse(ctx, record);
      return;
    case "line":
      drawLine(ctx, record);
      return;
    case "arrow":
      drawArrow(ctx, record);
      return;
    case "text":
    case "editedText":
      drawText(ctx, record);
      return;
    case "path":
      drawPath(ctx, record);
      return;
    case "image":
    case "signature":
    case "stamp":
      drawAssetImage(ctx, record, assetImages);
      return;
    case "highlight":
      drawHighlight(ctx, record);
      return;
    case "whiteout":
      drawWhiteout(ctx, record);
      return;
    case "redaction":
      drawRedaction(ctx, record);
      return;
    case "unsupported":
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Shape drawing functions
// ---------------------------------------------------------------------------

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  record: EditorRectangleRecord,
): void {
  const { x, y, width, height, style, rotation } = record;
  const opacity = style.opacity ?? 1;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.globalAlpha = opacity;

    if (style.fill && style.fill !== "transparent") {
      ctx.fillStyle = style.fill;
      ctx.fillRect(x, y, width, height);
    }

    if (style.stroke && style.stroke !== "transparent" && style.strokeWidth) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeRect(x, y, width, height);
    }

    ctx.globalAlpha = 1;
  });
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  record: EditorEllipseRecord,
): void {
  const { x, y, width, height, style, rotation } = record;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const opacity = style.opacity ?? 1;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);

    if (style.fill && style.fill !== "transparent") {
      ctx.fillStyle = style.fill;
      ctx.fill();
    }

    if (style.stroke && style.stroke !== "transparent" && style.strokeWidth) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  });
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  record: EditorLineRecord,
): void {
  const { x1, y1, x2, y2, style } = record;
  const opacity = style.opacity ?? 1;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = style.stroke || "#000000";
  ctx.lineWidth = style.strokeWidth || 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  record: EditorLineRecord,
): void {
  drawLine(ctx, record);

  const { x1, y1, x2, y2, style } = record;
  const strokeWidth = style.strokeWidth || 2;
  const opacity = style.opacity ?? 1;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(strokeWidth * 5, 12);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = style.stroke || "#000000";

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  record: EditorTextRecord,
): void {
  const { x, y, style, text, rotation } = record;
  const fontSize = style.fontSize || 16;
  const width = record.width || 0;
  const height = record.height || 0;
  const opacity = style.opacity ?? 1;

  const fontStyle = style.fontStyle === "italic" ? "italic" : "";
  const fontWeight = style.fontWeight || "normal";
  const fontFamily = style.fontFamily || "sans-serif";
  const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`.trim();

  const fillColor = style.fill || style.stroke || "#000000";
  const lines = text.split("\n");

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = font;
    ctx.fillStyle = fillColor;
    ctx.textBaseline = "top";

    if (style.textAlign === "center") {
      ctx.textAlign = "center";
    } else if (style.textAlign === "right") {
      ctx.textAlign = "right";
    } else {
      ctx.textAlign = "left";
    }

    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * fontSize;
      let lineX = x;

      if (style.textAlign === "center" && width) {
        lineX = x + width / 2;
      } else if (style.textAlign === "right" && width) {
        lineX = x + width;
      }

      ctx.fillText(lines[i], lineX, lineY);

      const lineWidth = ctx.measureText(lines[i]).width;
      const decoStartX = style.textAlign === "center" && width
        ? x + width / 2 - lineWidth / 2
        : style.textAlign === "right" && width
          ? x + width - lineWidth
          : x;

      if (style.underline) {
        ctx.beginPath();
        ctx.moveTo(decoStartX, lineY + fontSize * 0.95);
        ctx.lineTo(decoStartX + lineWidth, lineY + fontSize * 0.95);
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = Math.max(fontSize * 0.05, 1);
        ctx.stroke();
      }

      if (style.linethrough) {
        ctx.beginPath();
        ctx.moveTo(decoStartX, lineY + fontSize * 0.55);
        ctx.lineTo(decoStartX + lineWidth, lineY + fontSize * 0.55);
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = Math.max(fontSize * 0.05, 1);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  record: EditorPathRecord,
): void {
  const { x, y, width, height, svgPath, style, rotation } = record;
  const opacity = style.opacity ?? 1;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);

    const path2d = new Path2D(svgPath);

    if (style.fill && style.fill !== "transparent") {
      ctx.fillStyle = style.fill;
      ctx.fill(path2d);
    }

    if (style.stroke && style.stroke !== "transparent") {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth || 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(path2d);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

function drawAssetImage(
  ctx: CanvasRenderingContext2D,
  record: EditorImageRecord | EditorStampRecord,
  assetImages: Map<string, HTMLImageElement>,
): void {
  const { x, y, width, height, rotation, style } = record;
  const opacity = style.opacity ?? 1;
  const img = assetImages.get(record.id);

  if (!img) return;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(img, x, y, width, height);
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

function drawHighlight(
  ctx: CanvasRenderingContext2D,
  record: EditorRectangleRecord,
): void {
  const { x, y, width, height, style, rotation } = record;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.save();
    ctx.globalAlpha = style.opacity ?? 0.4;
    ctx.fillStyle = style.fill || style.stroke || "#FFFF00";
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

function drawWhiteout(
  ctx: CanvasRenderingContext2D,
  record: EditorRectangleRecord,
): void {
  const { x, y, width, height, rotation } = record;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  });
}

function drawRedaction(
  ctx: CanvasRenderingContext2D,
  record: EditorRectangleRecord,
): void {
  const { x, y, width, height, rotation } = record;

  withRotation(ctx, x, y, width, height, rotation, () => {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// Rotation helper
// ---------------------------------------------------------------------------

function withRotation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  draw: () => void,
): void {
  if (!angle) {
    draw();
    return;
  }

  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Image loading helpers
// ---------------------------------------------------------------------------

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load source image"));
    };

    img.src = url;
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load asset image"));
    img.src = dataUrl;
  });
}

async function preloadAssetImages(
  records: EditorObjectRecord[],
): Promise<Map<string, HTMLImageElement>> {
  const assetImages = new Map<string, HTMLImageElement>();
  const loadPromises: Promise<void>[] = [];

  for (const record of records) {
    if (
      (record.kind === "image" || record.kind === "signature" || record.kind === "stamp") &&
      record.asset?.dataUrl
    ) {
      const promise = loadImageFromDataUrl(record.asset.dataUrl).then((img) => {
        assetImages.set(record.id, img);
      });
      loadPromises.push(promise);
    }
  }

  await Promise.all(loadPromises);
  return assetImages;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
      },
      mimeType,
      quality,
    );
  });
}

"use client";

import type { StampData } from "../components/EditorToolbar";

export type EditorObjectKind =
  | "text"
  | "editedText"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "highlight"
  | "whiteout"
  | "redaction"
  | "image"
  | "signature"
  | "path"
  | "stamp"
  | "unsupported";

export type EditorFallbackMode = "auto" | "native" | "raster";

export interface EditorAsset {
  dataUrl: string;
  mimeType: string;
}

export interface EditorStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  textAlign?: string;
}

interface EditorObjectBase {
  id: string;
  kind: EditorObjectKind;
  page: number;
  zIndex: number;
  rotation: number;
  style: EditorStyle;
  sourceTool: string;
  fallbackMode: EditorFallbackMode;
  pairId?: string;
  asset?: EditorAsset;
}

export interface EditorTextRecord extends EditorObjectBase {
  kind: "text" | "editedText";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
}

export interface EditorRectangleRecord extends EditorObjectBase {
  kind: "rectangle" | "highlight" | "whiteout" | "redaction";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorEllipseRecord extends EditorObjectBase {
  kind: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorLineRecord extends EditorObjectBase {
  kind: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EditorPathRecord extends EditorObjectBase {
  kind: "path";
  x: number;
  y: number;
  width: number;
  height: number;
  path: unknown[];
  svgPath: string;
}

export interface EditorImageRecord extends EditorObjectBase {
  kind: "image" | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  asset: EditorAsset;
}

export interface EditorStampRecord extends EditorObjectBase {
  kind: "stamp";
  x: number;
  y: number;
  width: number;
  height: number;
  stamp: StampData;
  asset: EditorAsset;
}

export interface EditorUnsupportedRecord extends EditorObjectBase {
  kind: "unsupported";
  fabricData: Record<string, unknown>;
}

export type EditorObjectRecord =
  | EditorTextRecord
  | EditorRectangleRecord
  | EditorEllipseRecord
  | EditorLineRecord
  | EditorPathRecord
  | EditorImageRecord
  | EditorStampRecord
  | EditorUnsupportedRecord;

type FabricModule = Awaited<typeof import("fabric")>;

const EDITOR_CUSTOM_PROPERTIES = [
  "editorId",
  "editorKind",
  "sourceTool",
  "fallbackMode",
  "pairId",
  "asset",
  "stampData",
  "arrowData",
];

let fabricModule: FabricModule | null = null;

interface FabricEditorMetadata {
  editorId?: string;
  editorKind?: EditorObjectKind;
  sourceTool?: string;
  fallbackMode?: EditorFallbackMode;
  pairId?: string;
  asset?: EditorAsset;
  stampData?: StampData;
  arrowData?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    anchorLeft: number;
    anchorTop: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObjectLike = any;

export async function loadFabricModule(): Promise<FabricModule> {
  if (!fabricModule) {
    fabricModule = await import("fabric");
    const customProperties = new Set([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(((fabricModule as any).FabricObject.customProperties as string[]) || []),
      ...EDITOR_CUSTOM_PROPERTIES,
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fabricModule as any).FabricObject.customProperties = [...customProperties];
  }
  return fabricModule;
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function normalizeAngle(angle: number | undefined): number {
  const value = angle || 0;
  const normalized = ((value % 360) + 360) % 360;
  return round(normalized);
}

function parseMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);
  return match?.[1] || "image/png";
}

function makeAsset(dataUrl: string | undefined): EditorAsset | undefined {
  if (!dataUrl?.startsWith("data:")) return undefined;
  return {
    dataUrl,
    mimeType: parseMimeType(dataUrl),
  };
}

function getObjectBounds(obj: FabricObjectLike, zoom: number) {
  const rect =
    typeof obj.getBoundingRect === "function"
      ? obj.getBoundingRect()
      : {
          left: obj.left || 0,
          top: obj.top || 0,
          width: typeof obj.getScaledWidth === "function" ? obj.getScaledWidth() : (obj.width || 0) * (obj.scaleX || 1),
          height:
            typeof obj.getScaledHeight === "function" ? obj.getScaledHeight() : (obj.height || 0) * (obj.scaleY || 1),
        };
  return {
    left: round((rect.left || 0) / zoom),
    top: round((rect.top || 0) / zoom),
    width: round((rect.width || 0) / zoom),
    height: round((rect.height || 0) / zoom),
  };
}

function buildStyle(obj: FabricObjectLike): EditorStyle {
  return {
    fill: typeof obj.fill === "string" ? obj.fill : undefined,
    stroke: typeof obj.stroke === "string" ? obj.stroke : undefined,
    strokeWidth: obj.strokeWidth ? round(obj.strokeWidth) : undefined,
    opacity: typeof obj.opacity === "number" ? round(obj.opacity) : undefined,
    fontSize: obj.fontSize ? round(obj.fontSize) : undefined,
    fontFamily: obj.fontFamily,
    fontWeight: obj.fontWeight != null ? String(obj.fontWeight) : undefined,
    fontStyle: obj.fontStyle,
    underline: !!obj.underline,
    linethrough: !!obj.linethrough,
    textAlign: obj.textAlign,
  };
}

function inferKind(obj: FabricObjectLike): EditorObjectKind {
  const metadata = obj as FabricEditorMetadata;
  if (metadata.editorKind) return metadata.editorKind;

  if (obj.type === "textbox" || obj.type === "i-text") return "text";
  if (obj.type === "rect") {
    if (obj.stroke === "#FF0000" && obj.opacity === 0.5) return "redaction";
    if (obj.fill === "#FFFFFF" && !obj.stroke) return "whiteout";
    if (obj.opacity === 0.4) return "highlight";
    return "rectangle";
  }
  if (obj.type === "ellipse") return "ellipse";
  if (obj.type === "line") return "line";
  if (obj.type === "path") return "path";
  if (obj.type === "image") return "image";
  return "unsupported";
}

function buildBaseRecord(
  obj: FabricObjectLike,
  page: number,
  zIndex: number,
  kind: EditorObjectKind,
): Omit<EditorObjectBase, "page" | "zIndex" | "kind"> & Pick<EditorObjectBase, "page" | "zIndex" | "kind"> {
  const metadata = obj as FabricEditorMetadata;
  return {
    id: metadata.editorId || crypto.randomUUID(),
    kind,
    page,
    zIndex,
    rotation: normalizeAngle(obj.angle),
    style: buildStyle(obj),
    sourceTool: metadata.sourceTool || kind,
    fallbackMode: metadata.fallbackMode || (kind === "stamp" || kind === "unsupported" ? "raster" : "auto"),
    pairId: metadata.pairId,
    asset: metadata.asset,
  };
}

function pathToSvg(path: unknown[]): string {
  return path
    .map((segment) => {
      if (!Array.isArray(segment) || segment.length === 0) return "";
      const [command, ...values] = segment;
      return `${String(command)} ${values.join(" ")}`.trim();
    })
    .filter(Boolean)
    .join(" ");
}

function createArrowAsset(record: EditorLineRecord): EditorAsset {
  const width = Math.max(Math.abs(record.x2 - record.x1) + record.style.strokeWidth! * 8, 32);
  const height = Math.max(Math.abs(record.y2 - record.y1) + record.style.strokeWidth! * 8, 32);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * 2);
  canvas.height = Math.ceil(height * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      dataUrl: "",
      mimeType: "image/png",
    };
  }

  const minX = Math.min(record.x1, record.x2);
  const minY = Math.min(record.y1, record.y2);
  const padding = (record.style.strokeWidth || 2) * 4;
  const startX = (record.x1 - minX + padding) * 2;
  const startY = (record.y1 - minY + padding) * 2;
  const endX = (record.x2 - minX + padding) * 2;
  const endY = (record.y2 - minY + padding) * 2;
  const angle = Math.atan2(endY - startY, endX - startX);
  const headLength = Math.max((record.style.strokeWidth || 2) * 6, 18);

  ctx.strokeStyle = record.style.stroke || "#000000";
  ctx.fillStyle = record.style.stroke || "#000000";
  ctx.lineWidth = (record.style.strokeWidth || 2) * 2;
  ctx.globalAlpha = record.style.opacity ?? 1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  return {
    dataUrl: canvas.toDataURL("image/png"),
    mimeType: "image/png",
  };
}

export function createStampDataUrl(stamp: StampData): string {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = stamp.shape === "circle" ? 480 : 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = stamp.color;
  ctx.fillStyle = stamp.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (stamp.shape === "circle") {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 180;

    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillRect(centerX - 140, centerY - 34, 280, 68);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 44px Arial";
    ctx.fillText(stamp.text.toUpperCase(), centerX, centerY + 2);
    ctx.fillStyle = stamp.color;
    ctx.font = "bold 28px Arial";
    ctx.fillText(stamp.text.toUpperCase(), centerX, centerY - 110);
    ctx.fillText((stamp.subText || stamp.text).toUpperCase(), centerX, centerY + 112);
  } else {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.lineWidth = 12;
    ctx.strokeRect(-180, -60, 360, 120);
    ctx.lineWidth = 4;
    ctx.strokeRect(-166, -46, 332, 92);
    ctx.font = "bold 56px Arial";
    ctx.fillText(stamp.text.toUpperCase(), 0, 0);
  }

  return canvas.toDataURL("image/png");
}

export function attachEditorMetadata(obj: FabricObjectLike, metadata: FabricEditorMetadata): FabricObjectLike {
  Object.assign(obj, metadata);
  if (!obj.editorId) {
    obj.editorId = crypto.randomUUID();
  }
  if (!obj.fallbackMode) {
    obj.fallbackMode = metadata.editorKind === "stamp" ? "raster" : "auto";
  }
  return obj;
}

export function fabricObjectToRecord(
  obj: FabricObjectLike,
  page: number,
  zoom: number,
  zIndex: number,
): EditorObjectRecord {
  const kind = inferKind(obj);
  const base = buildBaseRecord(obj, page, zIndex, kind);
  const bounds = getObjectBounds(obj, zoom);

  switch (kind) {
    case "text":
    case "editedText":
      return {
        ...base,
        kind,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width || undefined,
        height: bounds.height || undefined,
        text: obj.text || "",
      };
    case "rectangle":
    case "highlight":
    case "whiteout":
    case "redaction":
      return {
        ...base,
        kind,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    case "ellipse":
      return {
        ...base,
        kind,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    case "line":
      return {
        ...base,
        kind,
        x1: round((obj.x1 || 0) / zoom),
        y1: round((obj.y1 || 0) / zoom),
        x2: round((obj.x2 || 0) / zoom),
        y2: round((obj.y2 || 0) / zoom),
      };
    case "arrow": {
      const arrowData = (obj as FabricEditorMetadata).arrowData;
      if (arrowData) {
        const deltaX = round((obj.left || 0) / zoom - arrowData.anchorLeft);
        const deltaY = round((obj.top || 0) / zoom - arrowData.anchorTop);
        return {
          ...base,
          kind,
          x1: round(arrowData.x1 + deltaX),
          y1: round(arrowData.y1 + deltaY),
          x2: round(arrowData.x2 + deltaX),
          y2: round(arrowData.y2 + deltaY),
          asset: createArrowAsset({
            ...base,
            kind,
            x1: round(arrowData.x1 + deltaX),
            y1: round(arrowData.y1 + deltaY),
            x2: round(arrowData.x2 + deltaX),
            y2: round(arrowData.y2 + deltaY),
          }),
        };
      }
      return {
        ...base,
        kind,
        x1: bounds.left,
        y1: bounds.top,
        x2: round(bounds.left + bounds.width),
        y2: round(bounds.top + bounds.height),
      };
    }
    case "path":
      return {
        ...base,
        kind,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
        path: Array.isArray(obj.path) ? obj.path : [],
        svgPath: pathToSvg(Array.isArray(obj.path) ? obj.path : []),
      };
    case "image":
    case "signature": {
      const asset =
        (obj as FabricEditorMetadata).asset ||
        makeAsset(typeof obj.getSrc === "function" ? obj.getSrc() : undefined) || {
          dataUrl: obj.toDataURL?.({ format: "png", multiplier: 1 }) || "",
          mimeType: "image/png",
        };
      return {
        ...base,
        kind,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
        asset,
      };
    }
    case "stamp": {
      const metadata = obj as FabricEditorMetadata;
      const stamp = metadata.stampData || { text: "STAMP", color: "#FF0000", shape: "rect" as const };
      const asset =
        metadata.asset || {
          dataUrl: obj.toDataURL?.({ format: "png", multiplier: 2 }) || createStampDataUrl(stamp),
          mimeType: "image/png",
        };
      return {
        ...base,
        kind,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
        stamp,
        asset,
      };
    }
    default:
      return {
        ...base,
        kind: "unsupported",
        fallbackMode: "raster",
        fabricData: obj.toObject ? obj.toObject(EDITOR_CUSTOM_PROPERTIES) : {},
      };
  }
}

export function legacyFabricObjectToRecord(
  obj: Record<string, unknown>,
  page: number,
  zIndex: number,
): EditorObjectRecord {
  const type = obj.type;
  const metadataKind = typeof obj.editorKind === "string" ? (obj.editorKind as EditorObjectKind) : undefined;
  const kind =
    metadataKind ||
    (type === "textbox" || type === "i-text"
      ? "text"
      : type === "rect"
        ? "rectangle"
        : type === "ellipse"
          ? "ellipse"
          : type === "line"
            ? "line"
            : type === "path"
              ? "path"
              : type === "image"
                ? "image"
                : "unsupported");

  const base = {
    id: typeof obj.editorId === "string" ? obj.editorId : crypto.randomUUID(),
    kind,
    page,
    zIndex,
    rotation: normalizeAngle(typeof obj.angle === "number" ? obj.angle : 0),
    style: {
      fill: typeof obj.fill === "string" ? obj.fill : undefined,
      stroke: typeof obj.stroke === "string" ? obj.stroke : undefined,
      strokeWidth: typeof obj.strokeWidth === "number" ? obj.strokeWidth : undefined,
      opacity: typeof obj.opacity === "number" ? obj.opacity : undefined,
      fontSize: typeof obj.fontSize === "number" ? obj.fontSize : undefined,
      fontFamily: typeof obj.fontFamily === "string" ? obj.fontFamily : undefined,
      fontWeight: typeof obj.fontWeight === "string" ? obj.fontWeight : undefined,
      fontStyle: typeof obj.fontStyle === "string" ? obj.fontStyle : undefined,
      underline: !!obj.underline,
      linethrough: !!obj.linethrough,
      textAlign: typeof obj.textAlign === "string" ? obj.textAlign : undefined,
    },
    sourceTool: typeof obj.sourceTool === "string" ? obj.sourceTool : kind,
    fallbackMode: kind === "unsupported" ? ("raster" as const) : ("auto" as const),
    pairId: typeof obj.pairId === "string" ? obj.pairId : undefined,
  };

  if (kind === "text" || kind === "editedText") {
    return {
      ...base,
      kind,
      x: typeof obj.left === "number" ? obj.left : 0,
      y: typeof obj.top === "number" ? obj.top : 0,
      width: typeof obj.width === "number" ? obj.width * (typeof obj.scaleX === "number" ? obj.scaleX : 1) : undefined,
      height:
        typeof obj.height === "number" ? obj.height * (typeof obj.scaleY === "number" ? obj.scaleY : 1) : undefined,
      text: typeof obj.text === "string" ? obj.text : "",
    };
  }

  if (kind === "rectangle" || kind === "highlight" || kind === "whiteout" || kind === "redaction") {
    return {
      ...base,
      kind,
      x: typeof obj.left === "number" ? obj.left : 0,
      y: typeof obj.top === "number" ? obj.top : 0,
      width: typeof obj.width === "number" ? obj.width * (typeof obj.scaleX === "number" ? obj.scaleX : 1) : 0,
      height: typeof obj.height === "number" ? obj.height * (typeof obj.scaleY === "number" ? obj.scaleY : 1) : 0,
    };
  }

  if (kind === "ellipse") {
    const rx = typeof obj.rx === "number" ? obj.rx * 2 : 0;
    const ry = typeof obj.ry === "number" ? obj.ry * 2 : 0;
    return {
      ...base,
      kind,
      x: typeof obj.left === "number" ? obj.left : 0,
      y: typeof obj.top === "number" ? obj.top : 0,
      width: rx * (typeof obj.scaleX === "number" ? obj.scaleX : 1),
      height: ry * (typeof obj.scaleY === "number" ? obj.scaleY : 1),
    };
  }

  if (kind === "line") {
    return {
      ...base,
      kind,
      x1: typeof obj.x1 === "number" ? obj.x1 : 0,
      y1: typeof obj.y1 === "number" ? obj.y1 : 0,
      x2: typeof obj.x2 === "number" ? obj.x2 : 0,
      y2: typeof obj.y2 === "number" ? obj.y2 : 0,
    };
  }

  if (kind === "path") {
    const path = Array.isArray(obj.path) ? obj.path : [];
    return {
      ...base,
      kind,
      x: typeof obj.left === "number" ? obj.left : 0,
      y: typeof obj.top === "number" ? obj.top : 0,
      width: typeof obj.width === "number" ? obj.width * (typeof obj.scaleX === "number" ? obj.scaleX : 1) : 0,
      height: typeof obj.height === "number" ? obj.height * (typeof obj.scaleY === "number" ? obj.scaleY : 1) : 0,
      path,
      svgPath: pathToSvg(path),
    };
  }

  if (kind === "image" || kind === "signature") {
    const asset = makeAsset(typeof obj.src === "string" ? obj.src : undefined) || {
      dataUrl: "",
      mimeType: "image/png",
    };
    return {
      ...base,
      kind,
      x: typeof obj.left === "number" ? obj.left : 0,
      y: typeof obj.top === "number" ? obj.top : 0,
      width: typeof obj.width === "number" ? obj.width * (typeof obj.scaleX === "number" ? obj.scaleX : 1) : 0,
      height: typeof obj.height === "number" ? obj.height * (typeof obj.scaleY === "number" ? obj.scaleY : 1) : 0,
      asset,
    };
  }

  return {
    ...base,
    kind: "unsupported",
    fallbackMode: "raster",
    fabricData: obj,
  };
}

function applySharedFabricProps(obj: FabricObjectLike, record: EditorObjectRecord, zoom: number): FabricObjectLike {
  obj.left = "x" in record ? record.x * zoom : obj.left;
  obj.top = "y" in record ? record.y * zoom : obj.top;
  obj.angle = record.rotation || 0;
  obj.opacity = record.style.opacity ?? 1;
  obj.originX = "left";
  obj.originY = "top";
  attachEditorMetadata(obj, {
    editorId: record.id,
    editorKind: record.kind,
    sourceTool: record.sourceTool,
    fallbackMode: record.fallbackMode,
    pairId: record.pairId,
    asset: record.asset,
    stampData: record.kind === "stamp" ? record.stamp : undefined,
  });
  return obj;
}

export async function recordToFabricObject(record: EditorObjectRecord, zoom: number): Promise<FabricObjectLike> {
  const fabric = await loadFabricModule();
  const { Rect, Ellipse, Line, Textbox, IText, Path, FabricImage, Group, Triangle, util } = fabric;

  switch (record.kind) {
    case "text":
    case "editedText": {
      const commonOptions = {
        left: record.x * zoom,
        top: record.y * zoom,
        width: record.width ? record.width * zoom : undefined,
        fontSize: (record.style.fontSize || 16) * zoom,
        fontFamily: record.style.fontFamily || "Arial",
        fontWeight: record.style.fontWeight || "normal",
        fontStyle: record.style.fontStyle || "normal",
        fill: record.style.fill || record.style.stroke || "#000000",
        underline: record.style.underline,
        linethrough: record.style.linethrough,
        textAlign: record.style.textAlign || "left",
        editable: true,
        originX: "left" as const,
        originY: "top" as const,
      };
      const obj =
        record.kind === "editedText" ? new IText(record.text, commonOptions) : new Textbox(record.text, commonOptions);
      return applySharedFabricProps(obj, record, zoom);
    }
    case "rectangle":
    case "highlight":
    case "whiteout":
    case "redaction": {
      const fill =
        record.kind === "redaction" ? createRedactionPattern(fabric) : record.style.fill || record.style.stroke || "transparent";
      const obj = new Rect({
        left: record.x * zoom,
        top: record.y * zoom,
        width: record.width * zoom,
        height: record.height * zoom,
        fill,
        stroke: record.kind === "redaction" ? "#FF0000" : record.style.stroke || "transparent",
        strokeWidth: (record.style.strokeWidth || 0) * zoom,
        opacity: record.kind === "highlight" ? record.style.opacity ?? 0.4 : record.style.opacity ?? 1,
        selectable: record.kind !== "whiteout",
        evented: record.kind !== "whiteout",
        originX: "left",
        originY: "top",
      });
      return applySharedFabricProps(obj, record, zoom);
    }
    case "ellipse": {
      const obj = new Ellipse({
        left: record.x * zoom,
        top: record.y * zoom,
        rx: (record.width * zoom) / 2,
        ry: (record.height * zoom) / 2,
        fill: record.style.fill || "transparent",
        stroke: record.style.stroke || "#000000",
        strokeWidth: (record.style.strokeWidth || 2) * zoom,
        originX: "left",
        originY: "top",
      });
      return applySharedFabricProps(obj, record, zoom);
    }
    case "line": {
      const obj = new Line([record.x1 * zoom, record.y1 * zoom, record.x2 * zoom, record.y2 * zoom], {
        stroke: record.style.stroke || "#000000",
        strokeWidth: (record.style.strokeWidth || 2) * zoom,
      });
      attachEditorMetadata(obj, {
        editorId: record.id,
        editorKind: record.kind,
        sourceTool: record.sourceTool,
        fallbackMode: record.fallbackMode,
        pairId: record.pairId,
      });
      return obj;
    }
    case "arrow": {
      const line = new Line([record.x1 * zoom, record.y1 * zoom, record.x2 * zoom, record.y2 * zoom], {
        stroke: record.style.stroke || "#000000",
        strokeWidth: (record.style.strokeWidth || 2) * zoom,
        selectable: false,
        evented: false,
      });
      const angle = Math.atan2(record.y2 - record.y1, record.x2 - record.x1);
      const headLength = Math.max((record.style.strokeWidth || 2) * zoom * 6, 12);
      const head = new Triangle({
        left: record.x2 * zoom,
        top: record.y2 * zoom,
        width: headLength,
        height: headLength,
        fill: record.style.stroke || "#000000",
        angle: (angle * 180) / Math.PI + 90,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
      });
      const group = new Group([line, head], {
        left: Math.min(record.x1, record.x2) * zoom,
        top: Math.min(record.y1, record.y2) * zoom,
        originX: "left",
        originY: "top",
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
      });
      attachEditorMetadata(group, {
        editorId: record.id,
        editorKind: "arrow",
        sourceTool: record.sourceTool,
        fallbackMode: record.fallbackMode,
        pairId: record.pairId,
        asset: record.asset,
        arrowData: {
          x1: record.x1,
          y1: record.y1,
          x2: record.x2,
          y2: record.y2,
          anchorLeft: Math.min(record.x1, record.x2),
          anchorTop: Math.min(record.y1, record.y2),
        },
      });
      return group;
    }
    case "path": {
      const obj = new Path(record.path as never, {
        left: record.x * zoom,
        top: record.y * zoom,
        fill: record.style.fill || "",
        stroke: record.style.stroke || "#000000",
        strokeWidth: (record.style.strokeWidth || 2) * zoom,
        scaleX: zoom,
        scaleY: zoom,
        originX: "left",
        originY: "top",
      });
      return applySharedFabricProps(obj, record, zoom);
    }
    case "image":
    case "signature":
    case "stamp": {
      const dataUrl = record.asset.dataUrl || (record.kind === "stamp" ? createStampDataUrl(record.stamp) : "");
      const img = await FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });
      const sourceWidth = img.width || record.width || 1;
      const sourceHeight = img.height || record.height || 1;
      img.set({
        left: record.x * zoom,
        top: record.y * zoom,
        scaleX: (record.width * zoom) / sourceWidth,
        scaleY: (record.height * zoom) / sourceHeight,
        originX: "left",
        originY: "top",
        angle: record.rotation || 0,
        opacity: record.style.opacity ?? 1,
      });
      attachEditorMetadata(img, {
        editorId: record.id,
        editorKind: record.kind,
        sourceTool: record.sourceTool,
        fallbackMode: record.fallbackMode,
        pairId: record.pairId,
        asset: record.asset,
        stampData: record.kind === "stamp" ? record.stamp : undefined,
      });
      return img;
    }
    default: {
      if (record.fabricData && Object.keys(record.fabricData).length > 0) {
        const [fabricObj] = await util.enlivenObjects([record.fabricData]);
        return attachEditorMetadata(fabricObj, {
          editorId: record.id,
          editorKind: "unsupported",
          sourceTool: record.sourceTool,
          fallbackMode: "raster",
        });
      }
      const obj = new Rect({
        left: 0,
        top: 0,
        width: 32,
        height: 32,
        fill: "#CCCCCC",
      });
      return applySharedFabricProps(obj, record, zoom);
    }
  }
}

function createRedactionPattern(fabric: FabricModule) {
  const patternCanvas = fabric.util.createCanvasElement();
  patternCanvas.width = 10;
  patternCanvas.height = 10;
  const ctx = patternCanvas.getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = "#FF0000";
  ctx.fillRect(0, 0, 10, 10);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(10, 0);
  ctx.stroke();
  return new fabric.Pattern({ source: patternCanvas, repeat: "repeat" });
}

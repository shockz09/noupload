"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  assetFromDataUrl,
  attachEditorMetadata,
  fabricObjectToRecord,
  loadFabricModule,
  recordToFabricObject,
  type EditorObjectRecord,
  type StampData,
} from "../lib/image-editor-objects";
import { animateCircleStamp, animateRectStamp, createInkSpreadEffect } from "../lib/stamp-animation";
import { createStampGroup } from "../lib/stamp-factory";
import type { ImageEditTool } from "./ImageEditorToolbar";

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

export interface ImageEditorCanvasProps {
  file: File;
  zoom: number;
  activeTool: ImageEditTool;
  strokeColor: string;
  fillColor: string;
  fontSize: number;
  drawWidth: number;
  objects: EditorObjectRecord[];
  onObjectsChange: (objects: EditorObjectRecord[]) => void;
  onUndoRedoChange: (canUndo: boolean, canRedo: boolean, undo: () => void, redo: () => void) => void;
  onDeleteSelected: (fn: (() => void) | null) => void;
  pendingSignature: string | null;
  onSignaturePlaced: () => void;
  pendingStamp: StampData | null;
  onStampPlaced: () => void;
  pendingInsertImage: string | null;
  onInsertImagePlaced: () => void;
  onFitZoomCalculated: (fitZoom: number) => void;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const MAX_HISTORY = 50;

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function ImageEditorCanvas({
  file,
  zoom,
  activeTool,
  strokeColor,
  fillColor,
  fontSize,
  drawWidth,
  objects,
  onObjectsChange,
  onUndoRedoChange,
  onDeleteSelected,
  pendingSignature,
  onSignaturePlaced,
  pendingStamp,
  onStampPlaced,
  pendingInsertImage,
  onInsertImagePlaced,
  onFitZoomCalculated,
}: ImageEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricWrapperRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fabricCanvas, setFabricCanvas] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricInstanceRef = useRef<any>(null);

  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [selectedObjectPos, setSelectedObjectPos] = useState<{ x: number; y: number } | null>(null);

  // History for undo/redo
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // For shape drawing
  const isDrawingShapeRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentShapeRef = useRef<any>(null);

  // For eraser dragging
  const isErasingRef = useRef(false);
  const erasedAnyRef = useRef(false);

  // Track loaded image element so zoom changes don't reload it
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const loadedFileRef = useRef<File | null>(null);

  // ──────────────────────────────────────────────
  // Save objects helper
  // ──────────────────────────────────────────────

  const saveObjects = useCallback(() => {
    if (!fabricCanvas) return;
    const records = fabricCanvas
      .getObjects()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((obj: any) => !obj.editorHelper)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((obj: any, index: number) => fabricObjectToRecord(obj, 1, zoom, index));
    onObjectsChange(records);
  }, [fabricCanvas, onObjectsChange, zoom]);

  // ──────────────────────────────────────────────
  // History management
  // ──────────────────────────────────────────────

  const updateUndoRedoState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const saveHistory = useCallback(() => {
    if (!fabricCanvas || isUndoRedoRef.current) return;

    const json = JSON.stringify(fabricCanvas.toJSON());

    // Truncate future states when not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;

    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }

    updateUndoRedoState();
  }, [fabricCanvas, updateUndoRedoState]);

  const undo = useCallback(async () => {
    if (!fabricCanvas || historyIndexRef.current <= 0) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current--;

    await fabricCanvas.loadFromJSON(historyRef.current[historyIndexRef.current]);
    fabricCanvas.renderAll();
    saveObjects();
    updateUndoRedoState();

    isUndoRedoRef.current = false;
  }, [fabricCanvas, saveObjects, updateUndoRedoState]);

  const redo = useCallback(async () => {
    if (!fabricCanvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current++;

    await fabricCanvas.loadFromJSON(historyRef.current[historyIndexRef.current]);
    fabricCanvas.renderAll();
    saveObjects();
    updateUndoRedoState();

    isUndoRedoRef.current = false;
  }, [fabricCanvas, saveObjects, updateUndoRedoState]);

  // Notify parent of undo/redo state changes
  useEffect(() => {
    onUndoRedoChange(canUndo, canRedo, undo, redo);
  }, [canUndo, canRedo, undo, redo, onUndoRedoChange]);

  // ──────────────────────────────────────────────
  // Selection position tracking
  // ──────────────────────────────────────────────

  const updateSelectionPos = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj: any) => {
      if (!obj) {
        setSelectedObjectPos(null);
        return;
      }
      const bound = obj.getBoundingRect?.();
      if (bound) {
        setSelectedObjectPos({
          x: bound.left + bound.width / 2 - 60,
          y: bound.top,
        });
      }
    },
    [],
  );

  // ──────────────────────────────────────────────
  // Load image (only when file changes)
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (loadedFileRef.current === file && loadedImageRef.current) return;

    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.src = objectUrl;

    img.onload = () => {
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      loadedImageRef.current = img;
      loadedFileRef.current = file;
      URL.revokeObjectURL(objectUrl);

      // Calculate fit zoom
      const container = containerRef.current;
      if (container) {
        const pad = 48;
        const availW = container.clientWidth - pad;
        const availH = container.clientHeight - pad;
        const fitZ = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
        onFitZoomCalculated(Math.round(fitZ * 100) / 100);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (!cancelled) console.error("Failed to load image for editor");
    };

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // ──────────────────────────────────────────────
  // Apply zoom + init/resize Fabric canvas
  // ──────────────────────────────────────────────

  useEffect(() => {
    const img = loadedImageRef.current;
    if (!img) return;

    let cancelled = false;

    const dw = Math.round(img.naturalWidth * zoom);
    const dh = Math.round(img.naturalHeight * zoom);

    setDisplayWidth(dw);
    setDisplayHeight(dh);

    // Draw image onto the background canvas (Retina-aware)
    // The canvas buffer is scaled by devicePixelRatio for sharp rendering
    // on HiDPI displays; CSS sizing is handled by React's style prop.
    const bgCanvas = imgCanvasRef.current;
    if (bgCanvas) {
      const dpr = window.devicePixelRatio || 1;
      bgCanvas.width = dw * dpr;
      bgCanvas.height = dh * dpr;
      const ctx = bgCanvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, dw, dh);
      }
    }

    initFabricCanvas(dw, dh).catch((err) => {
      if (!cancelled) console.error("Failed to init Fabric canvas:", err);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedImageRef.current, zoom]);

  // ──────────────────────────────────────────────
  // initFabricCanvas
  // ──────────────────────────────────────────────

  async function initFabricCanvas(width: number, height: number): Promise<void> {
    const wrapper = fabricWrapperRef.current;
    if (!wrapper) return;

    // Dispose existing canvas instance
    if (fabricInstanceRef.current) {
      fabricInstanceRef.current.dispose();
      fabricInstanceRef.current = null;
      setFabricCanvas(null);
    }

    wrapper.innerHTML = "";

    const canvasEl = document.createElement("canvas");
    canvasEl.style.display = "block";
    wrapper.appendChild(canvasEl);

    const { Canvas } = await loadFabricModule();

    const canvas = new Canvas(canvasEl, {
      width,
      height,
      selection: true,
      preserveObjectStacking: true,
      containerClass: "fabric-canvas-wrapper",
      perPixelTargetFind: true,
      targetFindTolerance: 8,
    });

    // Selection events
    canvas.on("selection:created", (e: { selected?: unknown[] }) => {
      const obj = e.selected?.[0] || null;
      setSelectedObject(obj);
      updateSelectionPos(obj);
    });
    canvas.on("selection:updated", (e: { selected?: unknown[] }) => {
      const obj = e.selected?.[0] || null;
      setSelectedObject(obj);
      updateSelectionPos(obj);
    });
    canvas.on("selection:cleared", () => {
      setSelectedObject(null);
      setSelectedObjectPos(null);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("object:moving", (e: any) => updateSelectionPos(e.target));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("object:scaling", (e: any) => updateSelectionPos(e.target));

    // Restore saved objects
    if (objects.length > 0) {
      for (const record of objects) {
        try {
          const fabricObj = await recordToFabricObject(record, zoom);
          canvas.add(fabricObj);
        } catch (err) {
          console.error("Failed to restore object:", err);
        }
      }
      canvas.renderAll();
    }

    // Initialize history with current state
    historyRef.current = [JSON.stringify(canvas.toJSON())];
    historyIndexRef.current = 0;
    updateUndoRedoState();

    fabricInstanceRef.current = canvas;
    setFabricCanvas(canvas);
  }

  // ──────────────────────────────────────────────
  // Track object modifications for history
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleModified = (event: any) => {
      const target = event?.target;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const helper = target?.arrowHelper as any;
      if (target?.editorKind === "arrow" && helper) {
        const angle = Math.atan2(target.y2 - target.y1, target.x2 - target.x1);
        helper.set({
          left: target.x2,
          top: target.y2,
          angle: (angle * 180) / Math.PI + 90,
        });
      }
      saveHistory();
      saveObjects();
    };

    fabricCanvas.on("object:modified", handleModified);

    return () => {
      if (fabricInstanceRef.current === fabricCanvas) {
        fabricCanvas.off("object:modified", handleModified);
      }
    };
  }, [fabricCanvas, saveHistory, saveObjects]);

  // ──────────────────────────────────────────────
  // Persist free-draw / eraser strokes
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlePathCreated = (event: any) => {
      if (event?.path) {
        attachEditorMetadata(event.path, {
          editorKind: "path",
          sourceTool: fabricCanvas.isDrawingMode ? (activeTool === "eraser" ? "eraser" : "draw") : "draw",
        });
        // Auto-select the drawn path so property changes apply to it
        event.path.selectable = true;
        event.path.evented = true;
        fabricCanvas.setActiveObject(event.path);
        fabricCanvas.renderAll();
        saveHistory();
        saveObjects();
      }
    };

    fabricCanvas.on("path:created", handlePathCreated);

    return () => {
      if (fabricInstanceRef.current === fabricCanvas) {
        fabricCanvas.off("path:created", handlePathCreated);
      }
    };
  }, [fabricCanvas, activeTool, saveHistory, saveObjects]);

  // ──────────────────────────────────────────────
  // Apply property changes to selected object
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObject();
    if (!active) return;

    let changed = false;

    // Text objects
    if (active.type === "textbox" || active.type === "i-text") {
      if (active.fontSize !== fontSize) {
        active.set("fontSize", fontSize);
        changed = true;
      }
      if (active.fill !== strokeColor) {
        active.set("fill", strokeColor);
        changed = true;
      }
    }

    // Shapes, lines, paths
    const shapeTypes = ["rect", "ellipse", "line", "circle", "triangle", "path", "group"];
    if (shapeTypes.includes(active.type || "")) {
      if (active.stroke !== strokeColor) {
        active.set("stroke", strokeColor);
        changed = true;
      }
      if (active.fill !== fillColor && active.editorKind !== "arrow") {
        active.set("fill", fillColor === "transparent" ? "" : fillColor);
        changed = true;
      }
      if (active.strokeWidth !== drawWidth) {
        active.set("strokeWidth", drawWidth);
        changed = true;
      }
    }

    if (changed) {
      active.dirty = true;
      active.setCoords?.();
      fabricCanvas.requestRenderAll();
      saveHistory();
      saveObjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, strokeColor, fillColor, drawWidth]);

  // ──────────────────────────────────────────────
  // Tool activation
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas) return;

    // Reset defaults
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.selection = false;
    fabricCanvas.defaultCursor = "default";
    fabricCanvas.hoverCursor = "default";

    if (activeTool === "select") {
      fabricCanvas.selection = true;
      fabricCanvas.hoverCursor = "move";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabricCanvas.getObjects().forEach((obj: any) => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else if (activeTool === "text") {
      fabricCanvas.defaultCursor = "text";
    } else if (activeTool === "draw") {
      fabricCanvas.isDrawingMode = true;
      loadFabricModule().then(({ PencilBrush }) => {
        if (fabricInstanceRef.current !== fabricCanvas) return;
        fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.color = strokeColor;
        fabricCanvas.freeDrawingBrush.width = drawWidth;
      });
    } else if (activeTool === "eraser") {
      fabricCanvas.defaultCursor = "crosshair";
      fabricCanvas.hoverCursor = "pointer";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabricCanvas.getObjects().forEach((obj: any) => {
        obj.selectable = false;
        obj.evented = true;
        obj.hoverCursor = "pointer";
      });
    } else if (activeTool.startsWith("shape-")) {
      fabricCanvas.defaultCursor = "crosshair";
    }

    fabricCanvas.renderAll();
  }, [activeTool, fabricCanvas, strokeColor, fillColor, drawWidth, fontSize]);

  // ──────────────────────────────────────────────
  // Mouse event handlers for tools
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = async (opt: any) => {
      const pointer = opt.pointer;

      // Eraser: drag to erase objects
      if (activeTool === "eraser") {
        isErasingRef.current = true;
        erasedAnyRef.current = false;
        const target = fabricCanvas.findTarget(opt.e);
        if (target) {
          fabricCanvas.remove(target);
          fabricCanvas.renderAll();
          erasedAnyRef.current = true;
        }
        return;
      }

      // Text: click to place
      if (activeTool === "text") {
        if (fabricCanvas.findTarget(opt.e)) return;

        const { Textbox } = await loadFabricModule();
        const textbox = new Textbox("Type here", {
          left: pointer.x,
          top: pointer.y,
          width: 200,
          fontSize,
          fontFamily: "Arial",
          fill: strokeColor,
          editable: true,
        });
        attachEditorMetadata(textbox, { editorKind: "text", sourceTool: "text" });

        fabricCanvas.add(textbox);
        fabricCanvas.setActiveObject(textbox);
        textbox.enterEditing();
        textbox.selectAll();
        fabricCanvas.renderAll();
        saveHistory();
        saveObjects();
        return;
      }

      // Shapes: drag to draw
      if (activeTool.startsWith("shape-")) {
        isDrawingShapeRef.current = true;
        shapeStartRef.current = { x: pointer.x, y: pointer.y };

        const { Rect, Ellipse, Line, FabricObject } = await loadFabricModule();
        let shape: InstanceType<typeof FabricObject> | null = null;

        if (activeTool === "shape-rect") {
          shape = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: drawWidth,
          });
          attachEditorMetadata(shape, { editorKind: "rectangle", sourceTool: activeTool });
        } else if (activeTool === "shape-circle") {
          shape = new Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: drawWidth,
          });
          attachEditorMetadata(shape, { editorKind: "ellipse", sourceTool: activeTool });
        } else if (activeTool === "shape-line" || activeTool === "shape-arrow") {
          shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: strokeColor,
            strokeWidth: drawWidth,
          });
          attachEditorMetadata(shape, {
            editorKind: activeTool === "shape-arrow" ? "arrow" : "line",
            sourceTool: activeTool,
          });
        }

        if (shape) {
          currentShapeRef.current = shape;
          fabricCanvas.add(shape);
          fabricCanvas.renderAll();
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (opt: any) => {
      // Eraser drag
      if (isErasingRef.current && activeTool === "eraser") {
        const target = fabricCanvas.findTarget(opt.e);
        if (target) {
          fabricCanvas.remove(target);
          fabricCanvas.renderAll();
          erasedAnyRef.current = true;
        }
        return;
      }

      if (!isDrawingShapeRef.current || !shapeStartRef.current || !currentShapeRef.current) return;

      const pointer = opt.pointer;
      const start = shapeStartRef.current;
      const shape = currentShapeRef.current;

      if (activeTool === "shape-rect") {
        const w = pointer.x - start.x;
        const h = pointer.y - start.y;
        shape.set({
          left: w > 0 ? start.x : pointer.x,
          top: h > 0 ? start.y : pointer.y,
          width: Math.abs(w),
          height: Math.abs(h),
        });
      } else if (activeTool === "shape-circle") {
        shape.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          rx: Math.abs(pointer.x - start.x) / 2,
          ry: Math.abs(pointer.y - start.y) / 2,
        });
      } else if (activeTool === "shape-line" || activeTool === "shape-arrow") {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }

      fabricCanvas.renderAll();
    };

    const handleMouseUp = async () => {
      // Eraser drag end
      if (isErasingRef.current) {
        isErasingRef.current = false;
        if (erasedAnyRef.current) {
          saveHistory();
          saveObjects();
          erasedAnyRef.current = false;
        }
        return;
      }

      if (!isDrawingShapeRef.current) return;
      isDrawingShapeRef.current = false;

      // Arrow: add arrowhead triangle
      if (activeTool === "shape-arrow" && currentShapeRef.current) {
        const line = currentShapeRef.current;
        const { Triangle } = await loadFabricModule();
        const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
        const headLength = 15;

        attachEditorMetadata(line, {
          editorKind: "arrow",
          sourceTool: "shape-arrow",
          arrowData: {
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            anchorLeft: Math.min(line.x1, line.x2),
            anchorTop: Math.min(line.y1, line.y2),
          },
        });

        const arrowHead = new Triangle({
          left: line.x2,
          top: line.y2,
          width: headLength,
          height: headLength,
          fill: strokeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (arrowHead as any).editorHelper = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (line as any).arrowHelper = arrowHead;
        fabricCanvas.add(arrowHead);
      }

      shapeStartRef.current = null;
      currentShapeRef.current = null;
      saveHistory();
      saveObjects();
      fabricCanvas.renderAll();
    };

    // Remove empty textboxes on editing exit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTextEditingExited = (e: any) => {
      const target = e?.target;
      if (target && typeof target.text === "string" && target.text.trim() === "") {
        fabricCanvas.remove(target);
      }
      saveHistory();
      saveObjects();
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);
    fabricCanvas.on("text:editing:exited", handleTextEditingExited);

    return () => {
      if (fabricInstanceRef.current === fabricCanvas) {
        fabricCanvas.off("mouse:down", handleMouseDown);
        fabricCanvas.off("mouse:move", handleMouseMove);
        fabricCanvas.off("mouse:up", handleMouseUp);
        fabricCanvas.off("text:editing:exited", handleTextEditingExited);
      }
    };
  }, [fabricCanvas, activeTool, strokeColor, fillColor, fontSize, drawWidth, saveObjects, saveHistory]);

  // ──────────────────────────────────────────────
  // Canvas-level keyboard shortcuts (copy/paste)
  // ──────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!fabricCanvas) return;
      const active = fabricCanvas.getActiveObject();

      // Don't intercept keys while editing text
      if (active?.isEditing) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Copy
      if (ctrl && e.key === "c") {
        if (active) {
          const cloned = await active.clone();
          // @ts-expect-error — lightweight clipboard via window global
          window.__fabricClipboard = cloned;
        }
      }

      // Paste
      if (ctrl && e.key === "v") {
        // @ts-expect-error — lightweight clipboard via window global
        const clipboard = window.__fabricClipboard;
        if (clipboard) {
          const cloned = await clipboard.clone();
          cloned.set({ left: cloned.left + 20, top: cloned.top + 20 });
          fabricCanvas.add(cloned);
          fabricCanvas.setActiveObject(cloned);
          fabricCanvas.renderAll();
          saveHistory();
          saveObjects();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fabricCanvas, saveObjects, saveHistory]);

  // ──────────────────────────────────────────────
  // Delete / Duplicate helpers
  // ──────────────────────────────────────────────

  const deleteSelectedObjects = useCallback(() => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeObjects.forEach((obj: any) => {
      if (obj.arrowHelper) fabricCanvas.remove(obj.arrowHelper);
      fabricCanvas.remove(obj);
    });
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    saveHistory();
    saveObjects();
  }, [fabricCanvas, saveHistory, saveObjects]);

  const duplicateSelected = useCallback(async () => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObject();
    if (!active) return;

    const cloned = await active.clone();
    cloned.set({ left: cloned.left + 20, top: cloned.top + 20 });
    fabricCanvas.add(cloned);
    fabricCanvas.setActiveObject(cloned);
    fabricCanvas.renderAll();
    saveHistory();
    saveObjects();
  }, [fabricCanvas, saveHistory, saveObjects]);

  // Expose deleteSelected to parent via ref callback
  useEffect(() => {
    onDeleteSelected(fabricCanvas ? deleteSelectedObjects : null);
  }, [fabricCanvas, onDeleteSelected, deleteSelectedObjects]);

  // ──────────────────────────────────────────────
  // Place pending signature
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas || !pendingSignature || !displayWidth) return;

    async function placeSignature() {
      const { FabricImage } = await loadFabricModule();
      const img = await FabricImage.fromURL(pendingSignature!);

      const maxWidth = displayWidth * 0.3;
      const scale = maxWidth / (img.width || 200);
      img.scale(scale);

      img.set({
        left: displayWidth / 2 - ((img.width || 200) * scale) / 2,
        top: displayHeight / 2 - ((img.height || 100) * scale) / 2,
      });
      attachEditorMetadata(img, {
        editorKind: "signature",
        sourceTool: "signature",
        asset: assetFromDataUrl(pendingSignature!),
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      saveHistory();
      saveObjects();
      onSignaturePlaced();
    }

    placeSignature();
  }, [fabricCanvas, pendingSignature, displayWidth, displayHeight, saveHistory, saveObjects, onSignaturePlaced]);

  // ──────────────────────────────────────────────
  // Place pending stamp
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas || !pendingStamp || !displayWidth) return;

    async function placeStamp() {
      const finalX = displayWidth / 2;
      const finalY = displayHeight / 2;
      const finalAngle = -12 + (Math.random() * 8 - 4);
      const isCircle = pendingStamp!.shape === "circle";

      const { group, radius } = await createStampGroup(pendingStamp!, finalX, finalY, finalAngle);
      fabricCanvas.add(group);

      // Animate the stamp landing
      const startTime = performance.now();
      const duration = isCircle ? 450 : 350;

      function animate(currentTime: number) {
        const progress = Math.min((currentTime - startTime) / duration, 1);

        if (isCircle) {
          animateCircleStamp(group, progress, finalAngle, finalX, finalY);
        } else {
          animateRectStamp(group, progress, finalAngle, finalX, finalY);
        }

        fabricCanvas.renderAll();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          group.set({ top: finalY, scaleX: 1, scaleY: 1, angle: finalAngle, opacity: 1 });
          fabricCanvas.setActiveObject(group);
          fabricCanvas.renderAll();
          saveHistory();
          saveObjects();
          onStampPlaced();
        }
      }

      requestAnimationFrame(animate);

      // Ink spread effect for circle stamps
      if (isCircle && fabricWrapperRef.current) {
        createInkSpreadEffect(fabricWrapperRef.current, finalX, finalY, radius, pendingStamp!.color, finalAngle);
      }
    }

    placeStamp();
  }, [fabricCanvas, pendingStamp, displayWidth, displayHeight, saveHistory, saveObjects, onStampPlaced]);

  // ──────────────────────────────────────────────
  // Place pending insert image
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!fabricCanvas || !pendingInsertImage || !displayWidth) return;

    async function placeImage() {
      const { FabricImage } = await loadFabricModule();
      const img = await FabricImage.fromURL(pendingInsertImage!);

      const maxWidth = Math.min(displayWidth * 0.5, 300);
      const maxHeight = Math.min(displayHeight * 0.5, 300);
      const scale = Math.min(maxWidth / (img.width || 200), maxHeight / (img.height || 200), 1);
      img.scale(scale);

      img.set({
        left: displayWidth / 2 - ((img.width || 200) * scale) / 2,
        top: displayHeight / 2 - ((img.height || 200) * scale) / 2,
      });
      attachEditorMetadata(img, {
        editorKind: "image",
        sourceTool: "image",
        asset: assetFromDataUrl(pendingInsertImage!),
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      saveHistory();
      saveObjects();
      onInsertImagePlaced();
    }

    placeImage();
  }, [fabricCanvas, pendingInsertImage, displayWidth, displayHeight, saveHistory, saveObjects, onInsertImagePlaced]);

  // ──────────────────────────────────────────────
  // Cleanup on unmount
  // ──────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (fabricInstanceRef.current) {
        fabricInstanceRef.current.dispose();
        fabricInstanceRef.current = null;
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  // Memoized styles
  // ──────────────────────────────────────────────

  const canvasContainerStyle = useMemo(
    () => ({ width: displayWidth || "auto", height: displayHeight || "auto" }),
    [displayWidth, displayHeight],
  );

  const imgCanvasStyle = useMemo(
    () => ({ position: "absolute" as const, top: 0, left: 0, width: displayWidth, height: displayHeight, display: "block" }),
    [displayWidth, displayHeight],
  );

  const fabricWrapperStyle = useMemo(
    () => ({ position: "absolute" as const, top: 0, left: 0, zIndex: 10, width: displayWidth || "100%", height: displayHeight || "100%" }),
    [displayWidth, displayHeight],
  );

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-6 bg-muted/30">
      <div className="relative shadow-[4px_4px_0_0_#1A1612]" style={canvasContainerStyle}>
        <canvas ref={imgCanvasRef} style={imgCanvasStyle} />
        <div ref={fabricWrapperRef} style={fabricWrapperStyle} />

        {/* Selection toolbar floating above selected object */}
        {selectedObjectPos && selectedObject && activeTool === "select" && (
          <div
            className="absolute z-50 flex gap-1"
            style={{ left: selectedObjectPos.x, top: selectedObjectPos.y - 40 }}
          >
            <button
              type="button"
              onClick={duplicateSelected}
              className="px-2 py-1 text-xs bg-card border-2 border-foreground hover:bg-muted"
              title="Duplicate"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={deleteSelectedObjects}
              className="px-2 py-1 text-xs bg-card border-2 border-foreground hover:bg-red-50 text-red-600"
              title="Delete"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

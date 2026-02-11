"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBackgroundRemoval } from "@/lib/background-removal/useBackgroundRemoval";
import { getPdfjsWorkerSrc } from "@/lib/pdfjs-config";
import type { FormField } from "../hooks/useFormFields";
import { type TextRegion, useTextExtraction } from "../hooks/useTextExtraction";
import type { PageState, Tool } from "../page";
import type { StampData } from "./EditorToolbar";
import { FormFieldOverlay } from "./FormFieldOverlay";

// Scale factor for PDF rendering (PDF internal coords to display coords)
const PDF_SCALE = 1.5;

// Cached fabric import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fabricModule: any = null;
async function getFabric() {
  if (!fabricModule) {
    fabricModule = await import("fabric");
  }
  return fabricModule;
}

interface EditorCanvasProps {
  file: File;
  currentPage: number;
  zoom: number;
  activeTool: Tool;
  pageStates: PageState[];
  highlightColor: string;
  strokeColor: string;
  fillColor: string;
  onObjectsChange?: (pageNumber: number, objects: object[]) => void;
  pageObjects?: Map<number, object[]>;
  onUndoRedoChange?: (canUndo: boolean, canRedo: boolean, undo: () => void, redo: () => void) => void;
  pendingSignature?: string | null;
  onSignaturePlaced?: () => void;
  pendingStamp?: StampData | null;
  onStampPlaced?: () => void;
  pendingImage?: string | null;
  onImagePlaced?: () => void;
  onFormFieldsChange?: (fields: FormField[]) => void;
  onToolChange?: (tool: Tool) => void;
  onTextFormattingChange?: (
    applyUnderline: () => void,
    applyStrikethrough: () => void,
    currentUnderline: boolean,
    currentStrikethrough: boolean,
  ) => void;
}

export function EditorCanvas({
  file,
  currentPage,
  zoom,
  activeTool,
  pageStates,
  highlightColor,
  strokeColor,
  fillColor,
  onObjectsChange,
  pageObjects,
  onUndoRedoChange,
  pendingSignature,
  onSignaturePlaced,
  pendingStamp,
  onStampPlaced,
  pendingImage,
  onImagePlaced,
  onFormFieldsChange,
  onToolChange: _onToolChange,
  onTextFormattingChange,
}: EditorCanvasProps) {
  void _onToolChange; // Reserved for future use
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricWrapperRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fabricCanvas, setFabricCanvas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedObject, setSelectedObject] = useState<any>(null);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricInstanceRef = useRef<any>(null);

  // Text extraction for click-to-edit
  const { regions: textRegions, isExtracting: isExtractingText } = useTextExtraction({
    file,
    pageNumber: currentPage,
    zoom,
  });

  // Background removal for images
  const { removeBackground, isProcessing: isRemovingBg, progress: bgProgress } = useBackgroundRemoval();
  const [removingBgObjectId, setRemovingBgObjectId] = useState<string | null>(null);

  // Form fields state
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [currentPageFields, setCurrentPageFields] = useState<FormField[]>([]);

  // Get current page state
  const pageState = pageStates.find((p) => p.pageNumber === currentPage);
  const rotation = pageState?.rotation || 0;
  const isDeleted = pageState?.deleted || false;

  // Save objects helper
  const saveObjects = useCallback(() => {
    if (!fabricCanvas || !onObjectsChange) return;
    const objects = fabricCanvas.getObjects().map((obj: { toObject: () => object }) => obj.toObject());
    onObjectsChange(currentPage, objects);
  }, [fabricCanvas, onObjectsChange, currentPage]);

  // Update undo/redo availability
  const updateUndoRedoState = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // Save state to history
  const saveHistory = useCallback(() => {
    if (!fabricCanvas || isUndoRedoRef.current) return;

    const json = JSON.stringify(fabricCanvas.toJSON());

    // Remove any future states if we're not at the end
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    // Add new state
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;

    // Limit history to 50 states
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }

    updateUndoRedoState();
  }, [fabricCanvas, updateUndoRedoState]);

  // Undo
  const undo = useCallback(async () => {
    if (!fabricCanvas || historyIndexRef.current <= 0) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current--;

    const json = historyRef.current[historyIndexRef.current];
    await fabricCanvas.loadFromJSON(json);
    fabricCanvas.renderAll();
    saveObjects();
    updateUndoRedoState();

    isUndoRedoRef.current = false;
  }, [fabricCanvas, saveObjects, updateUndoRedoState]);

  // Redo
  const redo = useCallback(async () => {
    if (!fabricCanvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current++;

    const json = historyRef.current[historyIndexRef.current];
    await fabricCanvas.loadFromJSON(json);
    fabricCanvas.renderAll();
    saveObjects();
    updateUndoRedoState();

    isUndoRedoRef.current = false;
  }, [fabricCanvas, saveObjects, updateUndoRedoState]);

  // Notify parent of undo/redo state changes
  useEffect(() => {
    if (onUndoRedoChange) {
      onUndoRedoChange(canUndo, canRedo, undo, redo);
    }
  }, [canUndo, canRedo, undo, redo, onUndoRedoChange]);

  // Load PDF document and detect form fields
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc(pdfjsLib.version);

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (!cancelled) {
          setPdfDoc(pdf);

          // Detect form fields
          const fields: FormField[] = [];
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            if (cancelled) return;
            const page = await pdf.getPage(pageNum);
            const annotations = await page.getAnnotations();
            const viewport = page.getViewport({ scale: 1 });

            for (const annot of annotations) {
              if (annot.subtype !== "Widget") continue;

              const fieldType = getFieldType(annot);
              if (!fieldType) continue;

              const rect = annot.rect;
              if (!rect || rect.length < 4) continue;

              const [x1, y1, x2, y2] = rect;

              fields.push({
                id: annot.id || `field-${pageNum}-${fields.length}`,
                name: annot.fieldName || "",
                type: fieldType,
                page: pageNum,
                rect: {
                  x: x1,
                  y: viewport.height - y2,
                  width: x2 - x1,
                  height: y2 - y1,
                },
                value: annot.fieldValue || "",
                options: annot.options?.map(
                  (opt: { exportValue?: string; displayValue?: string }) => opt.exportValue || opt.displayValue || "",
                ),
                maxLength: annot.maxLen,
                readOnly: annot.readOnly,
                required: annot.required,
                multiline: annot.multiLine,
              });
            }
          }

          if (!cancelled) {
            setFormFields(fields);
            onFormFieldsChange?.(fields);
          }
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Update current page fields when page changes
  useEffect(() => {
    setCurrentPageFields(formFields.filter((f) => f.page === currentPage));
  }, [formFields, currentPage]);

  // Form field value change handler
  const handleFormFieldChange = useCallback(
    (fieldId: string, value: string) => {
      setFormFields((prev) => {
        const updated = prev.map((f) => (f.id === fieldId ? { ...f, value } : f));
        onFormFieldsChange?.(updated);
        return updated;
      });
    },
    [onFormFieldsChange],
  );

  // Render current page
  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;
    setLoading(true);

    async function renderPage() {
      try {
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const page = await pdfDoc.getPage(currentPage);

        if (cancelled) return;

        const baseScale = PDF_SCALE;
        const viewport = page.getViewport({ scale: baseScale * zoom });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setDimensions({ width: viewport.width, height: viewport.height });

        const context = canvas.getContext("2d")!;
        context.clearRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        if (cancelled) return;

        // Initialize Fabric canvas
        await initFabricCanvas(viewport.width, viewport.height);

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to render page:", err);
          setLoading(false);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // Initialize Fabric canvas
  const initFabricCanvas = async (width: number, height: number) => {
    const wrapper = fabricWrapperRef.current;
    if (!wrapper) return;

    // Dispose existing using ref (avoids stale closure)
    if (fabricInstanceRef.current) {
      fabricInstanceRef.current.dispose();
      fabricInstanceRef.current = null;
      setFabricCanvas(null);
    }

    // Clear wrapper
    wrapper.innerHTML = "";

    // Create canvas at display dimensions (not internal PDF dimensions)
    // This avoids coordinate mapping issues with CSS transforms
    const displayW = width / PDF_SCALE;
    const displayH = height / PDF_SCALE;

    const canvasEl = document.createElement("canvas");
    canvasEl.style.display = "block";
    wrapper.appendChild(canvasEl);

    const { Canvas } = await getFabric();

    const canvas = new Canvas(canvasEl, {
      width: displayW,
      height: displayH,
      selection: true,
      preserveObjectStacking: true,
      containerClass: "fabric-canvas-wrapper",
    });

    // Selection events
    canvas.on("selection:created", (e: { selected?: unknown[] }) => {
      setSelectedObject(e.selected?.[0] || null);
    });
    canvas.on("selection:updated", (e: { selected?: unknown[] }) => {
      setSelectedObject(e.selected?.[0] || null);
    });
    canvas.on("selection:cleared", () => {
      setSelectedObject(null);
    });

    // Initialize history with current state
    // Note: Saved objects are loaded by the separate useEffect that watches pageObjects
    historyRef.current = [JSON.stringify(canvas.toJSON())];
    historyIndexRef.current = 0;

    fabricInstanceRef.current = canvas;
    setFabricCanvas(canvas);
  };

  // Reload objects when pageObjects changes (e.g., when restoring a draft)
  useEffect(() => {
    if (!fabricCanvas || !pageObjects) return;

    const savedObjects = pageObjects.get(currentPage);
    const canvasObjectCount = fabricCanvas.getObjects().length;

    // Only reload if canvas is empty but we have saved objects
    if (savedObjects && savedObjects.length > 0 && canvasObjectCount === 0) {
      const loadObjects = async () => {
        const fabric = await getFabric();
        const { util } = fabric;
        for (const obj of savedObjects) {
          try {
            const [fabricObj] = await util.enlivenObjects([obj]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fabricCanvas.add(fabricObj as any);
          } catch (err) {
            console.error("Failed to load object:", err);
          }
        }
        fabricCanvas.renderAll();

        // Update history with loaded state
        historyRef.current = [JSON.stringify(fabricCanvas.toJSON())];
        historyIndexRef.current = 0;
      };
      loadObjects();
    }
  }, [fabricCanvas, pageObjects, currentPage]);

  // Handle tool changes
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "draw";

    if (activeTool === "draw") {
      // Create brush if it doesn't exist (Fabric.js 6.x)
      if (!fabricCanvas.freeDrawingBrush) {
        getFabric().then(({ PencilBrush }) => {
          fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
          fabricCanvas.freeDrawingBrush.color = strokeColor;
          fabricCanvas.freeDrawingBrush.width = 2;
        });
      } else {
        fabricCanvas.freeDrawingBrush.color = strokeColor;
        fabricCanvas.freeDrawingBrush.width = 2;
      }
    }

    fabricCanvas.selection = activeTool === "select";
    fabricCanvas.renderAll();
  }, [fabricCanvas, activeTool, strokeColor]);

  // Handle mouse events for tools
  useEffect(() => {
    if (!fabricCanvas) return;

    // Helper to find text region at click position
    const findTextRegionAtPoint = (x: number, y: number): TextRegion | null => {
      for (const region of textRegions) {
        const { bbox } = region;
        if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
          return region;
        }
      }
      return null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = async (opt: any) => {
      const pointer = opt.pointer;

      // Click-to-edit: Check if clicking on detected text (only in select mode, when not clicking on existing object)
      if (activeTool === "select" && !fabricCanvas.findTarget(opt.e)) {
        const textRegion = findTextRegionAtPoint(pointer.x, pointer.y);
        if (textRegion) {
          const { Rect } = await getFabric();

          // Add some padding to the whiteout
          const padding = 2;

          // Create whiteout rectangle over original text
          const whiteout = new Rect({
            left: textRegion.bbox.x - padding,
            top: textRegion.bbox.y - padding,
            width: textRegion.bbox.width + padding * 2,
            height: textRegion.bbox.height + padding * 2,
            fill: "#FFFFFF",
            stroke: "transparent",
            selectable: false,
            evented: false,
          });

          // Create editable text (use IText to avoid auto-wrapping)
          const { IText } = await getFabric();
          const textObj = new IText(textRegion.text, {
            left: textRegion.bbox.x,
            top: textRegion.bbox.y,
            fontSize: textRegion.fontSize,
            fontFamily: textRegion.fontFamily,
            fontWeight: textRegion.fontWeight,
            fontStyle: textRegion.fontStyle,
            fill: textRegion.color,
            editable: true,
          });

          fabricCanvas.add(whiteout);
          fabricCanvas.add(textObj);
          fabricCanvas.setActiveObject(textObj);
          fabricCanvas.renderAll();

          // Enter editing with cursor at end
          textObj.enterEditing();
          textObj.setSelectionStart(textRegion.text.length);
          textObj.setSelectionEnd(textRegion.text.length);
          fabricCanvas.renderAll();

          saveHistory();
          saveObjects();
          return;
        }
      }

      // Text tool
      if (activeTool === "text") {
        if (fabricCanvas.findTarget(opt.e)) return;

        const { Textbox } = await getFabric();
        const textbox = new Textbox("Type here", {
          left: pointer.x,
          top: pointer.y,
          width: 200,
          fontSize: 16,
          fontFamily: "Arial",
          fill: strokeColor,
          editable: true,
        });

        fabricCanvas.add(textbox);
        fabricCanvas.setActiveObject(textbox);
        textbox.enterEditing();
        textbox.selectAll();
        fabricCanvas.renderAll();
        saveHistory();
        saveObjects();
        return;
      }

      // Shape tools (including markup tools)
      if (
        activeTool.startsWith("shape-") ||
        activeTool === "highlight" ||
        activeTool === "whiteout" ||
        activeTool === "redact"
      ) {
        isDrawingShapeRef.current = true;
        shapeStartRef.current = { x: pointer.x, y: pointer.y };

        const fabric = await getFabric();
        const { Rect, Ellipse, Line, FabricObject } = fabric;
        let shape: InstanceType<typeof FabricObject> | null = null;

        if (
          activeTool === "shape-rect" ||
          activeTool === "highlight" ||
          activeTool === "whiteout" ||
          activeTool === "redact"
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let fill: any = fillColor;
          let stroke = strokeColor;
          let opacity = 1;

          if (activeTool === "highlight") {
            fill = highlightColor;
            stroke = "transparent";
            opacity = 0.4;
          } else if (activeTool === "whiteout") {
            fill = "#FFFFFF";
            stroke = "transparent";
          } else if (activeTool === "redact") {
            // Create hatched pattern for redaction preview
            const patternCanvas = fabric.util.createCanvasElement();
            patternCanvas.width = 10;
            patternCanvas.height = 10;
            const ctx = patternCanvas.getContext("2d")!;
            ctx.fillStyle = "#FF0000";
            ctx.fillRect(0, 0, 10, 10);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 10);
            ctx.lineTo(10, 0);
            ctx.stroke();
            fill = new fabric.Pattern({ source: patternCanvas, repeat: "repeat" });
            stroke = "#FF0000";
            opacity = 0.5;
          }

          shape = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill,
            stroke,
            strokeWidth: activeTool === "shape-rect" ? 2 : 0,
            opacity,
          });
        } else if (activeTool === "shape-circle") {
          shape = new Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
          });
        } else if (activeTool === "shape-line" || activeTool === "shape-arrow") {
          shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: strokeColor,
            strokeWidth: 2,
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
      if (!isDrawingShapeRef.current || !shapeStartRef.current || !currentShapeRef.current) return;

      const pointer = opt.pointer;
      const start = shapeStartRef.current;
      const shape = currentShapeRef.current;

      if (
        activeTool === "shape-rect" ||
        activeTool === "highlight" ||
        activeTool === "whiteout" ||
        activeTool === "redact"
      ) {
        const width = pointer.x - start.x;
        const height = pointer.y - start.y;

        shape.set({
          left: width > 0 ? start.x : pointer.x,
          top: height > 0 ? start.y : pointer.y,
          width: Math.abs(width),
          height: Math.abs(height),
        });
      } else if (activeTool === "shape-circle") {
        const rx = Math.abs(pointer.x - start.x) / 2;
        const ry = Math.abs(pointer.y - start.y) / 2;

        shape.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          rx,
          ry,
        });
      } else if (activeTool === "shape-line" || activeTool === "shape-arrow") {
        shape.set({
          x2: pointer.x,
          y2: pointer.y,
        });
      }

      fabricCanvas.renderAll();
    };

    const handleMouseUp = async () => {
      if (!isDrawingShapeRef.current) return;

      isDrawingShapeRef.current = false;

      // Add arrow head if needed
      if (activeTool === "shape-arrow" && currentShapeRef.current) {
        const line = currentShapeRef.current;
        const { Polygon } = await getFabric();

        const x1 = line.x1,
          y1 = line.y1,
          x2 = line.x2,
          y2 = line.y2;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 15;

        const arrowHead = new Polygon(
          [
            { x: 0, y: 0 },
            { x: -headLength, y: headLength / 2 },
            { x: -headLength, y: -headLength / 2 },
          ],
          {
            left: x2,
            top: y2,
            fill: strokeColor,
            angle: (angle * 180) / Math.PI,
            originX: "center",
            originY: "center",
          },
        );

        fabricCanvas.add(arrowHead);
      }

      shapeStartRef.current = null;
      currentShapeRef.current = null;
      saveHistory();
      saveObjects();
      fabricCanvas.renderAll();
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      // Only remove handlers if this canvas is still the current one
      // (not disposed and replaced by a new canvas)
      if (fabricInstanceRef.current === fabricCanvas) {
        fabricCanvas.off("mouse:down", handleMouseDown);
        fabricCanvas.off("mouse:move", handleMouseMove);
        fabricCanvas.off("mouse:up", handleMouseUp);
      }
    };
  }, [fabricCanvas, activeTool, strokeColor, fillColor, highlightColor, saveObjects, saveHistory, textRegions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!fabricCanvas) return;

      const active = fabricCanvas.getActiveObject();

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        await undo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        await redo();
        return;
      }

      if (active?.isEditing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const objects = fabricCanvas.getActiveObjects();
        objects.forEach((obj: unknown) => fabricCanvas.remove(obj));
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        saveHistory();
        saveObjects();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const obj = fabricCanvas.getActiveObject();
        if (obj) {
          const cloned = await obj.clone();
          // @ts-expect-error clipboard
          window.__fabricClipboard = cloned;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        // @ts-expect-error clipboard
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
  }, [fabricCanvas, saveObjects, saveHistory, undo, redo]);

  // Track object modifications for history
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleModified = () => {
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

  // Place pending signature
  useEffect(() => {
    if (!fabricCanvas || !pendingSignature || !dimensions.width) return;

    const canvasWidth = dimensions.width / PDF_SCALE;
    const canvasHeight = dimensions.height / PDF_SCALE;

    const placeSignature = async () => {
      const { FabricImage } = await getFabric();
      const img = await FabricImage.fromURL(pendingSignature);

      // Scale to reasonable size
      const maxWidth = canvasWidth * 0.3;
      const scale = maxWidth / (img.width || 200);
      img.scale(scale);

      // Center on canvas
      img.set({
        left: canvasWidth / 2 - ((img.width || 200) * scale) / 2,
        top: canvasHeight / 2 - ((img.height || 100) * scale) / 2,
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      saveHistory();
      saveObjects();
      onSignaturePlaced?.();
    };

    placeSignature();
  }, [fabricCanvas, pendingSignature, dimensions, saveHistory, saveObjects, onSignaturePlaced]);

  // Provide text formatting functions to parent
  useEffect(() => {
    if (!fabricCanvas || !onTextFormattingChange) return;

    const applyUnderline = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === "textbox") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textbox = activeObject as any;
        textbox.set("underline", !textbox.underline);
        fabricCanvas.renderAll();
        saveHistory();
        saveObjects();
      }
    };

    const applyStrikethrough = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === "textbox") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textbox = activeObject as any;
        textbox.set("linethrough", !textbox.linethrough);
        fabricCanvas.renderAll();
        saveHistory();
        saveObjects();
      }
    };

    // Get current formatting from selected text
    const activeObject = fabricCanvas.getActiveObject();
    let currentUnderline = false;
    let currentStrikethrough = false;

    if (activeObject && activeObject.type === "textbox") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textbox = activeObject as any;
      currentUnderline = !!textbox.underline;
      currentStrikethrough = !!textbox.linethrough;
    }

    onTextFormattingChange(applyUnderline, applyStrikethrough, currentUnderline, currentStrikethrough);
  }, [fabricCanvas, onTextFormattingChange, saveHistory, saveObjects]);

  // Update formatting state when selection changes
  useEffect(() => {
    if (!fabricCanvas || !onTextFormattingChange) return;

    const handleSelectionChange = () => {
      const activeObject = fabricCanvas.getActiveObject();
      let currentUnderline = false;
      let currentStrikethrough = false;

      if (activeObject && activeObject.type === "textbox") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textbox = activeObject as any;
        currentUnderline = !!textbox.underline;
        currentStrikethrough = !!textbox.linethrough;
      }

      const applyUnderline = () => {
        const obj = fabricCanvas.getActiveObject();
        if (obj && obj.type === "textbox") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj as any).set("underline", !(obj as any).underline);
          fabricCanvas.renderAll();
          saveHistory();
          saveObjects();
        }
      };

      const applyStrikethrough = () => {
        const obj = fabricCanvas.getActiveObject();
        if (obj && obj.type === "textbox") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj as any).set("linethrough", !(obj as any).linethrough);
          fabricCanvas.renderAll();
          saveHistory();
          saveObjects();
        }
      };

      onTextFormattingChange(applyUnderline, applyStrikethrough, currentUnderline, currentStrikethrough);
    };

    fabricCanvas.on("selection:created", handleSelectionChange);
    fabricCanvas.on("selection:updated", handleSelectionChange);
    fabricCanvas.on("selection:cleared", handleSelectionChange);

    return () => {
      fabricCanvas.off("selection:created", handleSelectionChange);
      fabricCanvas.off("selection:updated", handleSelectionChange);
      fabricCanvas.off("selection:cleared", handleSelectionChange);
    };
  }, [fabricCanvas, onTextFormattingChange, saveHistory, saveObjects]);

  // Place pending stamp with animation
  useEffect(() => {
    if (!fabricCanvas || !pendingStamp || !dimensions.width) return;

    const canvasWidth = dimensions.width / PDF_SCALE;
    const canvasHeight = dimensions.height / PDF_SCALE;

    const placeStamp = async () => {
      const fabric = await getFabric();
      const { Rect, Group, Circle, Path, FabricText } = fabric;

      const stampColor = pendingStamp.color;
      const finalX = canvasWidth / 2;
      const finalY = canvasHeight / 2;
      const finalAngle = -12 + (Math.random() * 8 - 4);

      let group: InstanceType<typeof Group> | null = null;
      let stampRadius = 0;

      if (pendingStamp.shape === "circle") {
        // === AUTHENTIC RUBBER STAMP DESIGN ===
        const radius = 80;
        stampRadius = radius;
        const elements: object[] = [];
        const text = pendingStamp.text.toUpperCase();

        // --- SERRATED/GEAR OUTER EDGE ---
        const teeth = 48;
        const outerR = radius;
        const innerR = radius - 5;
        let serratedPath = "";

        for (let i = 0; i < teeth; i++) {
          const angle1 = (((i * 360) / teeth) * Math.PI) / 180;
          const angle2 = ((((i + 0.5) * 360) / teeth) * Math.PI) / 180;
          const x1 = Math.cos(angle1) * outerR;
          const y1 = Math.sin(angle1) * outerR;
          const x2 = Math.cos(angle2) * innerR;
          const y2 = Math.sin(angle2) * innerR;

          if (i === 0) {
            serratedPath = `M ${x1} ${y1}`;
          }
          serratedPath += ` L ${x2} ${y2}`;
          const angle3 = ((((i + 1) * 360) / teeth) * Math.PI) / 180;
          const x3 = Math.cos(angle3) * outerR;
          const y3 = Math.sin(angle3) * outerR;
          serratedPath += ` L ${x3} ${y3}`;
        }
        serratedPath += " Z";

        elements.push(
          new Path(serratedPath, {
            fill: stampColor,
            stroke: stampColor,
            strokeWidth: 1,
            originX: "center",
            originY: "center",
          }),
        );

        // --- INNER WHITE CIRCLE ---
        elements.push(
          new Circle({
            radius: radius - 8,
            fill: "#FFFFFF",
            stroke: "transparent",
            originX: "center",
            originY: "center",
          }),
        );

        // --- COLORED RING ---
        elements.push(
          new Circle({
            radius: radius - 10,
            fill: "transparent",
            stroke: stampColor,
            strokeWidth: 2,
            originX: "center",
            originY: "center",
          }),
        );

        // --- INNER WHITE CIRCLE FOR TEXT AREA ---
        elements.push(
          new Circle({
            radius: radius - 14,
            fill: "#FFFFFF",
            stroke: "transparent",
            originX: "center",
            originY: "center",
          }),
        );

        // --- CURVED TOP TEXT ---
        const textRadius = radius - 25;
        // Dynamic font size based on text length
        const fontSize = text.length > 10 ? 9 : text.length > 7 ? 10 : 11;
        // Arc should not exceed 160 degrees
        const maxArc = 150;
        const charSpacing = Math.min(maxArc / text.length, 15);
        const totalAngle = text.length * charSpacing;
        const startAngle = -90 - totalAngle / 2;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const charAngle = startAngle + (i + 0.5) * charSpacing;
          const radians = (charAngle * Math.PI) / 180;

          elements.push(
            new FabricText(char, {
              left: Math.cos(radians) * textRadius,
              top: Math.sin(radians) * textRadius,
              fontSize: fontSize,
              fontFamily: "Arial Black, Arial, sans-serif",
              fontWeight: "bold",
              fill: stampColor,
              originX: "center",
              originY: "center",
              angle: charAngle + 90,
            }),
          );
        }

        // --- CURVED BOTTOM TEXT (same text) ---
        const bottomStartAngle = 90 + totalAngle / 2;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const charAngle = bottomStartAngle - (i + 0.5) * charSpacing;
          const radians = (charAngle * Math.PI) / 180;

          elements.push(
            new FabricText(char, {
              left: Math.cos(radians) * textRadius,
              top: Math.sin(radians) * textRadius,
              fontSize: fontSize,
              fontFamily: "Arial Black, Arial, sans-serif",
              fontWeight: "bold",
              fill: stampColor,
              originX: "center",
              originY: "center",
              angle: charAngle - 90,
            }),
          );
        }

        // --- DECORATIVE STARS (separators between top/bottom text) ---
        elements.push(
          new FabricText("★", {
            left: -textRadius,
            top: 0,
            fontSize: 8,
            fill: stampColor,
            originX: "center",
            originY: "center",
          }),
        );
        elements.push(
          new FabricText("★", {
            left: textRadius,
            top: 0,
            fontSize: 8,
            fill: stampColor,
            originX: "center",
            originY: "center",
          }),
        );

        // --- CENTER BANNER/RIBBON ---
        const bannerWidth = Math.max(50, text.length * 6);
        const bannerHeight = 28;
        const bannerPath = `
					M ${-bannerWidth} ${-bannerHeight / 2}
					Q ${-bannerWidth - 8} 0 ${-bannerWidth} ${bannerHeight / 2}
					L ${bannerWidth} ${bannerHeight / 2}
					Q ${bannerWidth + 8} 0 ${bannerWidth} ${-bannerHeight / 2}
					Z
				`;
        elements.push(
          new Path(bannerPath, {
            fill: stampColor,
            stroke: stampColor,
            strokeWidth: 1,
            originX: "center",
            originY: "center",
          }),
        );

        // --- BIG CENTER TEXT (on banner) ---
        const centerFontSize = text.length > 10 ? 14 : text.length > 7 ? 16 : 18;
        elements.push(
          new FabricText(text, {
            left: 0,
            top: 0,
            fontSize: centerFontSize,
            fontFamily: "Arial Black, Arial, sans-serif",
            fontWeight: "bold",
            fill: "#FFFFFF",
            originX: "center",
            originY: "center",
            angle: -6,
          }),
        );

        // --- SMALL STARS ABOVE BANNER ---
        elements.push(
          new FabricText("★", {
            left: -18,
            top: -18,
            fontSize: 7,
            fill: stampColor,
            originX: "center",
            originY: "center",
          }),
        );
        elements.push(
          new FabricText("★", {
            left: 0,
            top: -22,
            fontSize: 7,
            fill: stampColor,
            originX: "center",
            originY: "center",
          }),
        );
        elements.push(
          new FabricText("★", {
            left: 18,
            top: -18,
            fontSize: 7,
            fill: stampColor,
            originX: "center",
            originY: "center",
          }),
        );

        group = new Group(elements, {
          left: finalX,
          top: finalY,
          originX: "center",
          originY: "center",
          angle: finalAngle,
        });
      } else {
        // === RECTANGULAR RUBBER STAMP ===
        const text = pendingStamp.text.toUpperCase();
        const fontSize = text.length > 10 ? 22 : text.length > 6 ? 26 : 30;
        const padding = 14;

        // Main text
        const stampText = new FabricText(text, {
          fontSize: fontSize,
          fontFamily: "Arial Black, Arial, sans-serif",
          fontWeight: "bold",
          fill: stampColor,
          originX: "center",
          originY: "center",
        });

        const textWidth = stampText.width || 100;
        const textHeight = stampText.height || 30;
        const borderWidth = textWidth + padding * 2;
        const borderHeight = textHeight + padding * 1.5;
        stampRadius = Math.max(borderWidth, borderHeight) / 2;

        // Outer border (thick)
        const outerBorder = new Rect({
          width: borderWidth + 8,
          height: borderHeight + 8,
          fill: "transparent",
          stroke: stampColor,
          strokeWidth: 4,
          rx: 2,
          ry: 2,
          originX: "center",
          originY: "center",
        });

        // Inner border (thin)
        const innerBorder = new Rect({
          width: borderWidth,
          height: borderHeight,
          fill: "transparent",
          stroke: stampColor,
          strokeWidth: 2,
          rx: 1,
          ry: 1,
          originX: "center",
          originY: "center",
        });

        group = new Group([outerBorder, innerBorder, stampText], {
          left: finalX,
          top: finalY,
          originX: "center",
          originY: "center",
          angle: finalAngle,
        });
      }

      fabricCanvas.add(group);

      const startTime = performance.now();
      const isCircle = pendingStamp.shape === "circle";

      // Different animations for circle vs rectangle
      const totalDuration = isCircle ? 450 : 350;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);

        if (isCircle) {
          // === SMOOTH ZOOM for circular stamps ===
          const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
          const easeOutElastic = (t: number) => {
            if (t === 0 || t === 1) return t;
            return 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
          };

          if (progress < 0.55) {
            // Zoom in from 2.5x with smooth cubic easing
            const p = progress / 0.55;
            const eased = easeOutCubic(p);
            const scale = 2.5 - 1.5 * eased;
            const opacity = 0.3 + 0.7 * eased;
            const rotation = finalAngle + 10 * (1 - eased);

            group.set({
              scaleX: scale,
              scaleY: scale,
              opacity: opacity,
              angle: rotation,
              top: finalY,
              left: finalX,
            });
          } else if (progress < 0.75) {
            // Gentle squash on impact
            const p = (progress - 0.55) / 0.2;
            const squash = Math.sin(p * Math.PI) * 0.6;

            group.set({
              scaleX: 1 + 0.08 * squash,
              scaleY: 1 - 0.06 * squash,
              opacity: 1,
              angle: finalAngle - 2 * squash,
              top: finalY + 3 * squash,
            });
          } else {
            // Smooth elastic settle
            const p = (progress - 0.75) / 0.25;
            const elastic = easeOutElastic(p);

            group.set({
              scaleX: 1 + 0.03 * (1 - elastic),
              scaleY: 1 - 0.02 * (1 - elastic),
              angle: finalAngle,
              top: finalY + 1 * (1 - elastic),
              opacity: 1,
            });
          }
        } else {
          // === SMOOTH SLAM for rectangular stamps ===
          // Smoother, more elegant animation
          const easeOutBack = (t: number) => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
          };

          if (progress < 0.6) {
            // Scale down from 2x with smooth easing
            const p = progress / 0.6;
            const eased = easeOutBack(p);
            const scale = 2 - 1 * eased;
            const opacity = 0.4 + 0.6 * p;

            group.set({
              scaleX: scale,
              scaleY: scale,
              opacity: opacity,
              angle: finalAngle + 8 * (1 - p),
              top: finalY,
              left: finalX,
            });
          } else if (progress < 0.8) {
            // Subtle squash
            const p = (progress - 0.6) / 0.2;
            const squash = Math.sin(p * Math.PI) * 0.5;

            group.set({
              scaleX: 1 + 0.05 * squash,
              scaleY: 1 - 0.03 * squash,
              opacity: 1,
              angle: finalAngle,
              top: finalY + 2 * squash,
            });
          } else {
            // Settle
            const p = (progress - 0.8) / 0.2;
            const settle = 1 - (1 - p) ** 3;

            group.set({
              scaleX: 1 + 0.05 * (1 - settle),
              scaleY: 1 - 0.03 * (1 - settle),
              angle: finalAngle,
              top: finalY + 2 * (1 - settle),
              opacity: 1,
            });
          }
        }

        fabricCanvas.renderAll();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete
          group.set({ top: finalY, scaleX: 1, scaleY: 1, angle: finalAngle, opacity: 1 });
          fabricCanvas.setActiveObject(group);
          fabricCanvas.renderAll();
          saveHistory();
          saveObjects();
          onStampPlaced?.();
        }
      };

      requestAnimationFrame(animate);

      // Ink spread effect - only for circle stamps (subtle for rect)
      const wrapper = fabricWrapperRef.current;
      if (wrapper && pendingStamp.shape === "circle") {
        const inkSize = stampRadius * 2 + 10;

        const inkRing = document.createElement("div");
        inkRing.style.cssText = `
					position: absolute;
					left: ${finalX}px;
					top: ${finalY}px;
					width: ${inkSize}px;
					height: ${inkSize}px;
					transform: translate(-50%, -50%) scale(0.9) rotate(${finalAngle}deg);
					border: 2px solid ${stampColor};
					border-radius: 50%;
					opacity: 0;
					pointer-events: none;
					z-index: 100;
				`;
        wrapper.appendChild(inkRing);

        const innerRing = document.createElement("div");
        innerRing.style.cssText = `
					position: absolute;
					left: ${finalX}px;
					top: ${finalY}px;
					width: ${inkSize - 14}px;
					height: ${inkSize - 14}px;
					transform: translate(-50%, -50%) scale(0.9) rotate(${finalAngle}deg);
					border: 1px solid ${stampColor};
					border-radius: 50%;
					opacity: 0;
					pointer-events: none;
					z-index: 100;
				`;
        wrapper.appendChild(innerRing);

        setTimeout(() => {
          inkRing.style.transition = "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
          inkRing.style.transform = `translate(-50%, -50%) scale(1.05) rotate(${finalAngle}deg)`;
          inkRing.style.opacity = "0.5";

          innerRing.style.transition = "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
          innerRing.style.transform = `translate(-50%, -50%) scale(1.05) rotate(${finalAngle}deg)`;
          innerRing.style.opacity = "0.3";

          setTimeout(() => {
            inkRing.style.transition = "all 0.2s ease-out";
            inkRing.style.transform = `translate(-50%, -50%) scale(1.15) rotate(${finalAngle}deg)`;
            inkRing.style.opacity = "0";

            innerRing.style.transition = "all 0.2s ease-out";
            innerRing.style.transform = `translate(-50%, -50%) scale(1.1) rotate(${finalAngle}deg)`;
            innerRing.style.opacity = "0";

            setTimeout(() => {
              inkRing.remove();
              innerRing.remove();
            }, 200);
          }, 120);
        }, 220);
      }
    };

    placeStamp();
  }, [fabricCanvas, pendingStamp, dimensions, saveHistory, saveObjects, onStampPlaced]);

  // Place pending image
  useEffect(() => {
    if (!fabricCanvas || !pendingImage || !dimensions.width) return;

    const canvasWidth = dimensions.width / PDF_SCALE;
    const canvasHeight = dimensions.height / PDF_SCALE;

    const placeImage = async () => {
      const { FabricImage } = await getFabric();
      const img = await FabricImage.fromURL(pendingImage);

      // Scale to fit within canvas (max 50% of canvas size)
      const maxWidth = canvasWidth * 0.5;
      const maxHeight = canvasHeight * 0.5;
      const scaleX = maxWidth / (img.width || 200);
      const scaleY = maxHeight / (img.height || 200);
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
      img.scale(scale);

      // Center on canvas
      img.set({
        left: canvasWidth / 2 - ((img.width || 200) * scale) / 2,
        top: canvasHeight / 2 - ((img.height || 200) * scale) / 2,
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      saveHistory();
      saveObjects();
      onImagePlaced?.();
    };

    placeImage();
  }, [fabricCanvas, pendingImage, dimensions, saveHistory, saveObjects, onImagePlaced]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fabricInstanceRef.current) {
        fabricInstanceRef.current.dispose();
        fabricInstanceRef.current = null;
      }
    };
  }, []);

  // Memoize display dimensions and style to prevent re-renders
  const displayDimensions = useMemo(
    () => ({
      width: dimensions.width / PDF_SCALE,
      height: dimensions.height / PDF_SCALE,
    }),
    [dimensions.width, dimensions.height],
  );

  const containerStyle = useMemo(
    () => ({
      width: displayDimensions.width || "auto",
      height: displayDimensions.height || "auto",
      transform: `rotate(${rotation}deg)`,
      transition: "transform 0.3s ease",
    }),
    [displayDimensions.width, displayDimensions.height, rotation],
  );

  return (
    <div ref={containerRef} className="flex-1 overflow-auto p-8 flex items-start justify-center">
      <div className="relative bg-white shadow-2xl" style={containerStyle}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading page...</p>
            </div>
          </div>
        )}

        {isDeleted && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 z-40">
            <div className="text-center p-6 bg-white/90 border-2 border-red-500">
              <p className="font-bold text-red-500">Page Deleted</p>
              <p className="text-sm text-muted-foreground">This page will be removed from the final PDF</p>
            </div>
          </div>
        )}

        {/* PDF Canvas */}
        <canvas
          ref={pdfCanvasRef}
          style={{
            width: displayDimensions.width,
            height: displayDimensions.height,
            display: "block",
          }}
        />

        {/* Fabric.js wrapper - positioned over PDF */}
        <div
          ref={fabricWrapperRef}
          className="absolute inset-0 z-10"
          style={{
            width: displayDimensions.width || "100%",
            height: displayDimensions.height || "100%",
            pointerEvents: loading ? "none" : "auto",
          }}
        />

        {/* Form field overlay - only show when there are form fields */}
        {currentPageFields.length > 0 && !loading && (
          <FormFieldOverlay fields={currentPageFields} scale={zoom} onFieldChange={handleFormFieldChange} />
        )}

        {selectedObject && activeTool === "select" && (
          <div className="absolute top-2 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="bg-card border-2 border-foreground shadow-[2px_2px_0_0_#1A1612] px-3 py-1.5 flex items-center gap-2 pointer-events-auto">
              {/* Remove BG button - only for images */}
              {selectedObject?.type === "image" && (
                <button
                  type="button"
                  disabled={isRemovingBg}
                  className={`text-xs font-bold px-2 py-0.5 border-2 transition-all ${
                    isRemovingBg && removingBgObjectId === selectedObject?.id
                      ? "bg-primary/10 text-primary border-primary animate-pulse"
                      : "text-primary hover:bg-primary hover:text-white border-primary"
                  }`}
                  onClick={async () => {
                    if (!fabricCanvas || !selectedObject || isRemovingBg) return;

                    const imgObj = selectedObject;
                    const imgElement = imgObj.getElement?.();
                    if (!imgElement) return;

                    setRemovingBgObjectId(imgObj.id || "unknown");

                    try {
                      // Get image data
                      const canvas = document.createElement("canvas");
                      canvas.width = imgElement.naturalWidth || imgElement.width;
                      canvas.height = imgElement.naturalHeight || imgElement.height;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      ctx.drawImage(imgElement, 0, 0);

                      const blob = await new Promise<Blob>((resolve, reject) => {
                        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed"))), "image/png");
                      });

                      // Remove background
                      const result = await removeBackground(blob, "medium");

                      // Replace image with new one
                      const { FabricImage } = await getFabric();
                      const newImg = await FabricImage.fromURL(result.url, { crossOrigin: "anonymous" });
                      newImg.set({
                        left: imgObj.left,
                        top: imgObj.top,
                        scaleX: imgObj.scaleX,
                        scaleY: imgObj.scaleY,
                        angle: imgObj.angle,
                        flipX: imgObj.flipX,
                        flipY: imgObj.flipY,
                        opacity: 0,
                      });

                      // Add new image, keep old for crossfade
                      fabricCanvas.add(newImg);
                      fabricCanvas.setActiveObject(newImg);

                      // Smooth crossfade animation
                      let progress = 0;
                      const duration = 20; // frames
                      const animate = () => {
                        progress++;
                        const t = Math.min(progress / duration, 1);
                        const ease = t * (2 - t); // ease-out

                        newImg.set("opacity", ease);
                        imgObj.set("opacity", 1 - ease);
                        fabricCanvas.renderAll();

                        if (progress < duration) {
                          requestAnimationFrame(animate);
                        } else {
                          fabricCanvas.remove(imgObj);
                          newImg.set("opacity", 1);
                          fabricCanvas.renderAll();
                        }
                      };
                      animate();

                      saveHistory();
                      saveObjects();
                      URL.revokeObjectURL(result.url);
                    } catch (err) {
                      console.error("Failed to remove background:", err);
                    } finally {
                      setRemovingBgObjectId(null);
                    }
                  }}
                >
                  {isRemovingBg && removingBgObjectId === selectedObject?.id ? (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      {bgProgress}
                    </span>
                  ) : (
                    "Remove BG"
                  )}
                </button>
              )}
              <button
                type="button"
                className="text-xs font-bold text-destructive hover:bg-destructive hover:text-white px-2 py-0.5 border-2 border-destructive transition-all"
                onClick={() => {
                  if (fabricCanvas) {
                    fabricCanvas.getActiveObjects().forEach((obj: unknown) => fabricCanvas.remove(obj));
                    fabricCanvas.discardActiveObject();
                    fabricCanvas.renderAll();
                    saveHistory();
                    saveObjects();
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Text extraction indicator */}
        {isExtractingText && (
          <div className="absolute bottom-2 left-2 z-50">
            <div className="bg-card/95 border border-foreground/20 shadow-lg px-2 py-1 flex items-center gap-2 text-xs">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">Analyzing text...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to determine form field type from annotation
function getFieldType(annot: {
  fieldType?: string;
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
}): FormField["type"] | null {
  if (annot.fieldType === "Tx") return "text";
  if (annot.fieldType === "Btn") {
    if (annot.checkBox) return "checkbox";
    if (annot.radioButton) return "radio";
    if (annot.pushButton) return "button";
    return "checkbox";
  }
  if (annot.fieldType === "Ch") {
    return "select";
  }
  return null;
}

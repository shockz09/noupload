import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/image/edit")({
	head: () => ({
		meta: [
			{ title: "Edit Image Free - Add Text, Shapes, Drawings & Signatures | noupload" },
			{ name: "description", content: "Annotate and edit images in your browser. Add text, shapes, arrows, freehand drawings, stamps, and signatures. No upload needed." },
			{ name: "keywords", content: "edit image, annotate image, draw on image, add text to image, image editor online, image markup, sign image, stamp image, free image editor, browser image editor" },
			{ property: "og:title", content: "Edit Image Free - Annotate & Draw on Images" },
			{ property: "og:description", content: "Add text, shapes, drawings, stamps, and signatures to your images. Everything runs in your browser." },
		],
	}),
	component: ImageEditPage,
});

import { useCallback, useEffect, useRef, useState } from "react";

import { SignatureModal } from "@/app/edit/components/SignatureModal";
import { EditIcon } from "@/components/icons/ui";
import { ImagePageHeader } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox } from "@/components/shared";
import { useImagePaste } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getOutputFilename } from "@/lib/image-utils";

import { ImageEditorCanvas } from "@/app/image/edit/components/ImageEditorCanvas";
import type { ImageEditTool } from "@/app/image/edit/components/ImageEditorToolbar";
import { ImageEditorToolbar } from "@/app/image/edit/components/ImageEditorToolbar";
import { ImageEditorZoomControls } from "@/app/image/edit/components/ImageEditorZoomControls";
import type { EditorObjectRecord, StampData } from "@/app/image/edit/lib/image-editor-objects";
import { exportImage } from "@/app/image/edit/lib/export-image";

// Preset zoom levels — the fit zoom is inserted dynamically
const BASE_ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

function getZoomLevels(fitZoom: number | null): number[] {
  if (!fitZoom) return BASE_ZOOM_LEVELS;
  // Insert fit zoom into the sorted list (dedupe if it matches an existing level)
  const rounded = Math.round(fitZoom * 100) / 100;
  const set = new Set([...BASE_ZOOM_LEVELS, rounded]);
  return [...set].sort((a, b) => a - b);
}

function ImageEditPage() {
  // File
  const [file, setFile] = useState<File | null>(null);

  // Editor state
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<ImageEditTool>("select");
  const [objects, setObjects] = useState<EditorObjectRecord[]>([]);

  // Undo/redo
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoRef = useRef<(() => void) | null>(null);
  const redoRef = useRef<(() => void) | null>(null);
  const deleteSelectedRef = useRef<(() => void) | null>(null);

  // Tool options
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("transparent");
  const [fontSize, setFontSize] = useState(24);
  const [drawWidth, setDrawWidth] = useState(3);

  // Pending items
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [pendingStamp, setPendingStamp] = useState<StampData | null>(null);
  const [pendingInsertImage, setPendingInsertImage] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Export
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const outputFormat = "png" as const;

  // Snapshot of previous file+objects so paste-while-editing is undoable
  const prevFileRef = useRef<{ file: File; objects: EditorObjectRecord[] } | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    // Save current state so we can undo a paste replacement
    if (file) {
      prevFileRef.current = { file, objects };
    } else {
      prevFileRef.current = null;
    }
    setFile(files[0]);
    setObjects([]);
    setZoom(1);
    setActiveTool("select");
    setExportError(null);
    initialZoomSetRef.current = false;
  }, [file, objects]);

  // Undo paste: restore previous file + objects
  const handleUndoPaste = useCallback(() => {
    const prev = prevFileRef.current;
    if (!prev) return;
    setFile(prev.file);
    setObjects(prev.objects);
    setZoom(1);
    setActiveTool("select");
    initialZoomSetRef.current = false;
    prevFileRef.current = null;
  }, []);

  useImagePaste(handleFileSelected);

  // Undo/redo callbacks
  const handleUndoRedoChange = useCallback(
    (newCanUndo: boolean, newCanRedo: boolean, undo: () => void, redo: () => void) => {
      setCanUndo(newCanUndo);
      setCanRedo(newCanRedo);
      undoRef.current = undo;
      redoRef.current = redo;
    },
    [],
  );

  const handleDeleteSelected = useCallback((fn: (() => void) | null) => {
    deleteSelectedRef.current = fn;
  }, []);

  const handleUndo = useCallback(() => undoRef.current?.(), []);
  const handleRedo = useCallback(() => redoRef.current?.(), []);

  // Zoom — uses preset levels so fit zoom is always reachable
  const fitZoomRef = useRef<number | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => {
      const levels = getZoomLevels(fitZoomRef.current);
      const next = levels.find((l) => l > z + 0.001);
      return next ?? levels[levels.length - 1];
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => {
      const levels = getZoomLevels(fitZoomRef.current);
      const prev = [...levels].reverse().find((l) => l < z - 0.001);
      return prev ?? levels[0];
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(fitZoomRef.current ?? 1);
  }, []);

  // Pending item handlers
  const handleSignatureCreate = useCallback((dataUrl: string) => {
    setPendingSignature(dataUrl);
    setShowSignatureModal(false);
    setActiveTool("select");
  }, []);

  const handleStampSelect = useCallback((stamp: StampData) => {
    setPendingStamp(stamp);
    setActiveTool("select");
  }, []);

  const handleInsertImage = useCallback((dataUrl: string) => {
    setPendingInsertImage(dataUrl);
    setActiveTool("select");
  }, []);

  const handleChangeFile = useCallback(() => {
    setFile(null);
    setObjects([]);
    setZoom(1);
    setActiveTool("select");
    setCanUndo(false);
    setCanRedo(false);
    setExportError(null);
    initialZoomSetRef.current = false;
    fitZoomRef.current = null;
    prevFileRef.current = null;
  }, []);

  const initialZoomSetRef = useRef(false);
  const handleFitZoomCalculated = useCallback((fitZoom: number) => {
    fitZoomRef.current = fitZoom;
    if (!initialZoomSetRef.current) {
      initialZoomSetRef.current = true;
      setZoom(fitZoom);
    }
  }, []);

  // Export helpers
  const doExport = useCallback(async () => {
    if (!file) return null;
    return exportImage({
      sourceFile: file,
      objects,
      outputFormat,
      outputQuality: outputFormat === "png" ? 1 : 0.92,
    });
  }, [file, objects, outputFormat]);

  const handleDownload = useCallback(async () => {
    if (!file) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await doExport();
      if (!result) return;
      const filename = getOutputFilename(file.name, outputFormat, "_edited");
      downloadBlob(result.blob, filename, `image/${outputFormat}`);
    } catch (err) {
      setExportError(getErrorMessage(err, "Failed to export image"));
    } finally {
      setIsExporting(false);
    }
  }, [file, outputFormat, doExport]);

  const handleCopy = useCallback(async () => {
    if (!file) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await doExport();
      if (!result) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": result.blob }),
      ]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setExportError(getErrorMessage(err, "Failed to copy image"));
    } finally {
      setIsExporting(false);
    }
  }, [file, doExport]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undoRef.current?.();
        } else if (prevFileRef.current) {
          handleUndoPaste();
        }
        return;
      }
      if (ctrl && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        redoRef.current?.();
        return;
      }
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handleDownload();
        return;
      }

      if (!ctrl && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            break;
          case "t":
            setActiveTool("text");
            break;
          case "d":
            setActiveTool("draw");
            break;
          case "e":
            setActiveTool("eraser");
            break;
          case "r":
            setActiveTool("shape-rect");
            break;
          case "c":
            setActiveTool("shape-circle");
            break;
          case "delete":
          case "backspace":
            deleteSelectedRef.current?.();
            break;
          case "=":
            handleZoomIn();
            break;
          case "-":
            handleZoomOut();
            break;
          case "escape":
            setActiveTool("select");
            break;
        }
      }
    },
    [handleDownload, handleZoomIn, handleZoomOut, canUndo, handleUndoPaste],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="page-enter">
      {!file ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <ImagePageHeader
            icon={<EditIcon className="w-7 h-7" />}
            iconClass="tool-image-edit"
            title="Edit Image"
            description="Add text, shapes, signatures, stamps, and drawings to your image"
          />
          <div className="max-w-2xl mx-auto">
            <FileDropzone
              accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif"
              multiple={false}
              onFilesSelected={handleFileSelected}
              title="Drop your image here"
              subtitle="or click to browse"
            />
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-120px)] flex flex-col -mx-4 sm:-mx-6 -my-8 sm:-my-12">
          <ImageEditorToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            strokeColor={strokeColor}
            onStrokeColorChange={setStrokeColor}
            fillColor={fillColor}
            onFillColorChange={setFillColor}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            drawWidth={drawWidth}
            onDrawWidthChange={setDrawWidth}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSignatureClick={() => setShowSignatureModal(true)}
            onStampSelect={handleStampSelect}
            onImageInsert={handleInsertImage}
            onChangeFile={handleChangeFile}
          />

          <ImageEditorCanvas
            file={file}
            zoom={zoom}
            activeTool={activeTool}
            strokeColor={strokeColor}
            fillColor={fillColor}
            fontSize={fontSize}
            drawWidth={drawWidth}
            objects={objects}
            onObjectsChange={setObjects}
            onUndoRedoChange={handleUndoRedoChange}
            onDeleteSelected={handleDeleteSelected}
            pendingSignature={pendingSignature}
            onSignaturePlaced={() => setPendingSignature(null)}
            pendingStamp={pendingStamp}
            onStampPlaced={() => setPendingStamp(null)}
            pendingInsertImage={pendingInsertImage}
            onInsertImagePlaced={() => setPendingInsertImage(null)}
            onFitZoomCalculated={handleFitZoomCalculated}
          />

          {exportError && (
            <div className="px-4 py-2">
              <ErrorBox message={exportError} />
            </div>
          )}

          <ImageEditorZoomControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
            onDownload={handleDownload}
            onCopy={handleCopy}
            isExporting={isExporting}
            copySuccess={copySuccess}
          />
        </div>
      )}

      <SignatureModal
        open={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSignatureCreate={handleSignatureCreate}
      />
    </div>
  );
}

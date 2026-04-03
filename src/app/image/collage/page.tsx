"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { XIcon } from "@/components/icons/ui";
import { CollageIcon } from "@/components/icons/image";
import { ErrorBox, ImagePageHeader, ImageResultView, ProgressBar } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useFileBuffer, useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { type CollageLayout, copyImageToClipboard, createCollage, formatFileSize } from "@/lib/image-utils";

interface FileItem {
  id: string;
  file: File;
  preview: string;
}

type LayoutType = "grid" | "horizontal" | "vertical" | "mosaic";

const LAYOUTS: { type: LayoutType; label: string }[] = [
  { type: "grid", label: "Grid" },
  { type: "horizontal", label: "Row" },
  { type: "vertical", label: "Column" },
  { type: "mosaic", label: "Mosaic" },
];

const BG_OPTIONS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#000000", label: "Black" },
  { value: "transparent", label: "None" },
];

export default function CollagePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [layout, setLayout] = useState<LayoutType>("grid");
  const [gap, setGap] = useState(8);
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [borderRadius, setBorderRadius] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult();
  const { url: previewUrl, setSource: setPreviewSource, revoke: revokePreview } = useObjectURL();
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => {
    const count = files.length;
    if (layout === "mosaic") {
      if (count <= 3) return 2;
      return 3;
    }
    if (layout !== "grid") return undefined;
    if (count <= 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    if (count <= 9) return 3;
    return 4;
  }, [files.length, layout]);

  const outputSize = useMemo(() => {
    const count = files.length;
    if (layout === "horizontal") {
      return { width: Math.min(count * 400, 1920), height: 400 };
    }
    if (layout === "vertical") {
      return { width: 600, height: Math.min(count * 400, 1920) };
    }
    if (layout === "mosaic") {
      const cols = columns || 3;
      return { width: cols * 400, height: Math.round(cols * 400 * 1.4) };
    }
    const cols = columns || 2;
    const rows = Math.ceil(count / cols);
    return { width: cols * 400, height: rows * 400 };
  }, [files.length, layout, columns]);

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      const items = newFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));
      setFiles((prev) => [...prev, ...items].slice(0, 12));
      clearResult();
    },
    [clearResult],
  );

  useImagePaste(handleFilesSelected, !result);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    clearResult();
    revokePreview();
  }, [files, clearResult, revokePreview]);

  const handleDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId) {
        setDragId(null);
        setDragOverId(null);
        return;
      }
      setFiles((prev) => {
        const arr = [...prev];
        const fromIdx = arr.findIndex((f) => f.id === dragId);
        const toIdx = arr.findIndex((f) => f.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        return arr;
      });
      setDragId(null);
      setDragOverId(null);
      navigator.vibrate?.(5);
    },
    [dragId],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (files.length < 2 || !startProcessing()) return;

    try {
      setProgress(20);

      const collageLayout: CollageLayout = {
        type: layout,
        columns: layout === "grid" || layout === "mosaic" ? columns : undefined,
        gap,
        backgroundColor: bgColor,
        borderRadius,
      };

      setProgress(40);
      const format = bgColor === "transparent" ? "png" : "jpeg";
      const blob = await createCollage(files.map((f) => f.file), collageLayout, outputSize, format);

      setProgress(90);
      setResult(blob, `collage.${format === "png" ? "png" : "jpg"}`);
      setPreviewSource(blob);
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create collage"));
    } finally {
      stopProcessing();
    }
  }, [files, layout, columns, gap, bgColor, borderRadius, outputSize, startProcessing, setProgress, setResult, setPreviewSource, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    clearResult();
    revokePreview();
  }, [files, clearResult, revokePreview]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: result.blob.type,
      size: result.blob.size,
      fileType: "image",
      sourceToolLabel: "Collage Maker",
    });
  }, [result, addToBuffer]);

  const totalSize = useMemo(() => files.reduce((acc, f) => acc + f.file.size, 0), [files]);

  // CSS grid classes for live preview
  const getPreviewGrid = () => {
    const count = files.length;
    if (layout === "horizontal") {
      if (count <= 2) return "grid-cols-2";
      if (count <= 3) return "grid-cols-3";
      if (count <= 4) return "grid-cols-4";
      if (count <= 5) return "grid-cols-5";
      return "grid-cols-6";
    }
    if (layout === "vertical") return "grid-cols-1";
    if (layout === "mosaic") {
      return count <= 3 ? "grid-cols-2" : "grid-cols-3";
    }
    if (count <= 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<CollageIcon className="w-7 h-7" />}
        iconClass="tool-collage"
        title="Collage Maker"
        description="Combine multiple images into one"
      />

      {result ? (
        <ImageResultView
          blob={result.blob}
          title="Collage Created!"
          subtitle={`${files.length} images combined`}
          downloadLabel="Download Collage"
          onDownload={handleDownload}
          onCopy={result.blob.type === "image/png" ? () => copyImageToClipboard(result.blob) : undefined}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Create Another"
        />
      ) : (
        <div className="space-y-6">
          {files.length === 0 ? (
            <div className="max-w-2xl mx-auto space-y-6">
              <FileDropzone
                accept=".jpg,.jpeg,.png,.webp"
                multiple={true}
                maxFiles={12}
                onFilesSelected={handleFilesSelected}
                title="Drop your images here"
                subtitle="Select 2-12 images"
              />
              <InfoBox title="Collage Maker">
                Drop 2-12 images, pick a layout, tweak gap and corners, then create. Drag images to reorder.
              </InfoBox>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6" ref={scrollRef}>
              {/* Left: Live Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {files.length} images ({formatFileSize(totalSize)})
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                {/* Live collage preview */}
                <div
                  className="border-2 border-foreground overflow-hidden"
                  style={{
                    background:
                      bgColor === "transparent"
                        ? "repeating-conic-gradient(#e5e5e5 0% 25%, white 0% 50%) 50% / 16px 16px"
                        : bgColor,
                    padding: `${gap}px`,
                  }}
                >
                  <div
                    className={`grid ${getPreviewGrid()}`}
                    style={{ gap: `${gap}px` }}
                  >
                    {files.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        onDragOver={(e) => handleDragOver(e, item.id)}
                        onDrop={() => handleDrop(item.id)}
                        onDragEnd={handleDragEnd}
                        className={`relative aspect-square overflow-hidden group cursor-grab active:cursor-grabbing transition-all ${
                          dragId === item.id
                            ? "opacity-40 scale-95"
                            : dragOverId === item.id && dragId
                              ? "ring-2 ring-primary scale-105"
                              : ""
                        }`}
                        style={{ borderRadius: `${borderRadius}px` }}
                      >
                        <img
                          src={item.preview}
                          alt=""
                          className="w-full h-full object-cover pointer-events-none"
                          draggable={false}
                        />
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="absolute top-1 right-1 w-5 h-5 bg-foreground/80 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add More */}
                {files.length < 12 && (
                  <FileDropzone
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple={true}
                    maxFiles={12 - files.length}
                    onFilesSelected={handleFilesSelected}
                    title="Add more images"
                    subtitle={`${12 - files.length} slots remaining`}
                    compact
                  />
                )}

              </div>

              {/* Right: Controls */}
              <div className="space-y-5">
                {/* Layout */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Layout</span>
                  <div className="grid grid-cols-4 gap-2">
                    {LAYOUTS.map((l) => (
                      <button
                        key={l.type}
                        type="button"
                        onClick={() => setLayout(l.type)}
                        className={`py-2 text-center border-2 border-foreground text-xs font-bold transition-colors ${
                          layout === l.type ? "bg-foreground text-background" : "hover:bg-muted"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gap */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Gap</span>
                    <span className="text-xs font-bold tabular-nums">{gap}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={gap}
                    onChange={(e) => setGap(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                {/* Border Radius */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Corners</span>
                    <span className="text-xs font-bold tabular-nums">{borderRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                {/* Background */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Background</span>
                  <div className="flex gap-2">
                    {BG_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBgColor(opt.value)}
                        className={`flex-1 py-2 text-xs font-bold border-2 transition-colors ${
                          bgColor === opt.value
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/30 hover:border-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {bgColor === "transparent" && (
                    <p className="text-xs text-muted-foreground">Will export as PNG</p>
                  )}
                </div>

                {error && <ErrorBox message={error} />}
                {isProcessing && <ProgressBar progress={progress} label="Creating collage..." />}

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isProcessing || files.length < 2}
                  className="btn-primary w-full"
                >
                  <CollageIcon className="w-5 h-5" />
                  {isProcessing ? "Creating..." : "Create Collage"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

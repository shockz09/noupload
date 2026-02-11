"use client";

import { useCallback, useMemo, useState } from "react";
import { CollageIcon, XIcon } from "@/components/icons";
import { ErrorBox, ImagePageHeader, ProgressBar, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useObjectURL, useProcessingResult } from "@/hooks";
import { type CollageLayout, copyImageToClipboard, createCollage, formatFileSize } from "@/lib/image-utils";

interface FileItem {
  id: string;
  file: File;
  preview: string;
}

type LayoutType = "grid" | "horizontal" | "vertical";

const LAYOUTS: { type: LayoutType; label: string; description: string }[] = [
  { type: "grid", label: "Grid", description: "Square grid layout" },
  { type: "horizontal", label: "Row", description: "Side by side" },
  { type: "vertical", label: "Column", description: "Stacked vertically" },
];

export default function CollagePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [layout, setLayout] = useState<LayoutType>("grid");

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult();
  const { url: previewUrl, setSource: setPreviewSource, revoke: revokePreview } = useObjectURL();

  // Auto-calculate columns based on image count
  const columns = useMemo(() => {
    if (layout !== "grid") return undefined;
    const count = files.length;
    if (count <= 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    if (count <= 9) return 3;
    return 4;
  }, [files.length, layout]);

  // Auto-calculate output size based on layout and image count
  const outputSize = useMemo(() => {
    const count = files.length;
    if (layout === "horizontal") {
      return { width: Math.min(count * 400, 1920), height: 400 };
    }
    if (layout === "vertical") {
      return { width: 600, height: Math.min(count * 400, 1920) };
    }
    // Grid - square-ish
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
      setFiles((prev) => [...prev, ...items].slice(0, 12)); // Max 12 images
      clearResult();
    },
    [clearResult],
  );

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

  const handleCreate = useCallback(async () => {
    if (files.length < 2 || !startProcessing()) return;

    try {
      setProgress(20);

      const collageLayout: CollageLayout = {
        type: layout === "grid" ? "grid" : layout,
        columns: layout === "grid" ? columns : undefined,
        gap: 8,
      };

      setProgress(40);

      const blob = await createCollage(
        files.map((f) => f.file),
        collageLayout,
        outputSize,
      );

      setProgress(90);
      setResult(blob, "collage.jpg");
      setPreviewSource(blob);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create collage");
    } finally {
      stopProcessing();
    }
  }, [
    files,
    layout,
    columns,
    outputSize,
    startProcessing,
    setProgress,
    setResult,
    setPreviewSource,
    setError,
    stopProcessing,
  ]);

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

  const totalSize = useMemo(() => files.reduce((acc, f) => acc + f.file.size, 0), [files]);

  // Generate grid preview layout - use explicit classes for Tailwind
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
    // Grid
    if (count <= 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<CollageIcon className="w-7 h-7" />}
        iconClass="tool-collage"
        title="Collage Maker"
        description="Combine multiple images into one"
      />

      {result ? (
        <div className="space-y-6">
          <SuccessCard
            stampText="Created"
            title="Collage Created!"
            subtitle={`${files.length} images combined`}
            downloadLabel="Download Collage"
            onDownload={handleDownload}
            onCopy={() => copyImageToClipboard(result.blob)}
            onStartOver={handleStartOver}
            startOverLabel="Create Another"
          />
          {previewUrl && (
            <div className="border-2 border-foreground overflow-hidden">
              <img src={previewUrl} alt="Collage preview" className="w-full h-auto" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {files.length === 0 ? (
            <>
              <FileDropzone
                accept=".jpg,.jpeg,.png,.webp"
                multiple={true}
                maxFiles={12}
                onFilesSelected={handleFilesSelected}
                title="Drop your images here"
                subtitle="Select 2-12 images"
              />
              <div className="info-box">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <div className="text-sm">
                  <p className="font-bold text-foreground mb-1">Collage Maker</p>
                  <p className="text-muted-foreground">
                    Drop 2-12 images and choose a layout. Images will be automatically arranged and sized to fit.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Image Preview with Clear */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {files.length} images ({formatFileSize(totalSize)})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-sm font-bold text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>

                {/* Thumbnail Grid */}
                <div className={`grid gap-2 ${getPreviewGrid()}`}>
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className="relative aspect-square border-2 border-foreground overflow-hidden group"
                    >
                      <img src={item.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
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

              {/* Layout Selection */}
              <div className="space-y-3">
                <span className="font-bold">Layout</span>
                <div className="grid grid-cols-3 gap-3">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.type}
                      type="button"
                      onClick={() => setLayout(l.type)}
                      className={`p-4 text-center border-2 border-foreground transition-colors ${
                        layout === l.type ? "bg-foreground text-background" : "hover:bg-muted"
                      }`}
                    >
                      {/* Visual Layout Preview */}
                      <div className="mb-2 flex justify-center">
                        {l.type === "grid" && (
                          <div className="grid grid-cols-2 gap-0.5 w-8 h-8">
                            <div className={`${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                          </div>
                        )}
                        {l.type === "horizontal" && (
                          <div className="flex gap-0.5 w-10 h-6">
                            <div className={`flex-1 ${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`flex-1 ${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`flex-1 ${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                          </div>
                        )}
                        {l.type === "vertical" && (
                          <div className="flex flex-col gap-0.5 w-6 h-10">
                            <div className={`flex-1 ${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`flex-1 ${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                            <div className={`flex-1 ${layout === l.type ? "bg-background/60" : "bg-foreground/60"}`} />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-bold block">{l.label}</span>
                      <span className={`text-xs ${layout === l.type ? "text-background/70" : "text-muted-foreground"}`}>
                        {l.description}
                      </span>
                    </button>
                  ))}
                </div>
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
                {isProcessing ? "Creating..." : `Create Collage`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

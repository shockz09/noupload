"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, LoaderIcon } from "@/components/icons/ui";
import { ImageIcon } from "@/components/icons/image";
import { PdfIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages } from "@/components/pdf/pdf-page-preview";
import { ErrorBox, PdfFileInfo, PdfPageHeader } from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { type ConvertedImage, downloadImagesAsZip, pdfToImages } from "@/lib/pdf-image-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

function RotateIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface PageItem {
  id: string;
  pageNumber: number;
  selected: boolean;
  rotation: 0 | 90 | 180 | 270;
}

type ImageFormat = "jpeg" | "png";
type ImageQuality = "low" | "medium" | "high";

const QUALITY_SETTINGS: Record<ImageQuality, { scale: number; quality: number; label: string }> = {
  low: { scale: 1, quality: 0.7, label: "Fast (1x)" },
  medium: { scale: 1.5, quality: 0.85, label: "Balanced (1.5x)" },
  high: { scale: 2, quality: 0.95, label: "High Quality (2x)" },
};

export default function PdfToImagesPage() {
  const { isInstant } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [pageItems, setPageItems] = useState<PageItem[]>([]);
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [format, setFormat] = useState<ImageFormat>("jpeg");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const instantTriggeredRef = useRef(false);

  // Use custom hook for processing state
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const { pages, loading: pagesLoading } = usePdfPages(file, 0.3);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
    };
  }, [images]);

  // Initialize page items when pages load
  if (pages.length > 0 && pageItems.length === 0) {
    setPageItems(
      pages.map((p) => ({
        id: `page-${p.pageNumber}`,
        pageNumber: p.pageNumber,
        selected: true,
        rotation: 0,
      })),
    );
  }

  // Process all pages with default settings (for instant mode)
  const processAllPages = useCallback(async () => {
    if (!file || pages.length === 0) return;
    if (!startProcessing()) return;

    try {
      const settings = QUALITY_SETTINGS.medium;
      const result = await pdfToImages(file, {
        format: "jpeg",
        quality: settings.quality,
        scale: settings.scale,
        pageNumbers: pages.map((p) => p.pageNumber),
        rotations: {},
        onProgress: (current, total) => {
          setProgress(Math.round((current / total) * 100));
        },
      });
      setImages(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to convert PDF"));
    } finally {
      stopProcessing();
    }
  }, [file, pages, startProcessing, setProgress, setError, stopProcessing]);

  // Instant mode: auto-convert when pages are loaded
  useEffect(() => {
    if (isInstant && file && pages.length > 0 && !instantTriggeredRef.current && !isProcessing && images.length === 0) {
      instantTriggeredRef.current = true;
      processAllPages();
    }
  }, [isInstant, file, pages, isProcessing, images.length, processAllPages]);

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
        instantTriggeredRef.current = false;
        setFile(files[0]);
        clearError();
        setImages([]);
        setPageItems([]);
      }
    },
    [images, clearError],
  );

  const handleClear = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
    instantTriggeredRef.current = false;
    setFile(null);
    clearError();
    setImages([]);
    setPageItems([]);
  }, [images, clearError]);

  const togglePage = useCallback((id: string) => {
    setPageItems((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }, []);

  const rotatePage = useCallback((id: string) => {
    setPageItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : p)),
    );
  }, []);

  const selectAll = useCallback(() => {
    setPageItems((prev) => prev.map((p) => ({ ...p, selected: true })));
  }, []);

  const selectNone = useCallback(() => {
    setPageItems((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  const handleConvert = useCallback(async () => {
    if (!file) return;

    const selectedItems = pageItems.filter((p) => p.selected);
    if (selectedItems.length === 0) {
      setError("Select at least one page to convert");
      return;
    }

    if (!startProcessing()) return;

    try {
      const settings = QUALITY_SETTINGS[quality];
      const result = await pdfToImages(file, {
        format,
        quality: settings.quality,
        scale: settings.scale,
        pageNumbers: selectedItems.map((p) => p.pageNumber),
        rotations: Object.fromEntries(selectedItems.map((p) => [p.pageNumber, p.rotation])),
        onProgress: (current, total) => {
          setProgress(Math.round((current / total) * 100));
        },
      });
      setImages(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to convert PDF"));
    } finally {
      stopProcessing();
    }
  }, [file, pageItems, quality, format, startProcessing, setProgress, setError, stopProcessing]);

  const handleDownloadAll = () => {
    if (file && images.length > 0) {
      const baseName = getFileBaseName(file.name);
      downloadImagesAsZip(images, baseName, format);
    }
  };

  const handleDownloadSingle = (image: ConvertedImage) => {
    if (file) {
      const baseName = getFileBaseName(file.name);
      const ext = format === "png" ? "png" : "jpg";
      downloadBlob(image.blob, `${baseName}_page${image.pageNumber}.${ext}`);
    }
  };

  const handleStartOver = () => {
    images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
    setImages([]);
  };

  const handleNewFile = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
    instantTriggeredRef.current = false;
    setFile(null);
    setImages([]);
    clearError();
    setPageItems([]);
  }, [images, clearError]);

  const selectedCount = pageItems.filter((p) => p.selected).length;
  const rotatedCount = pageItems.filter((p) => p.selected && p.rotation !== 0).length;

  // Memoize page preview lookup for O(1) access
  const pagePreviewMap = useMemo(() => {
    return new Map(pages.map((p) => [p.pageNumber, p.dataUrl]));
  }, [pages]);

  const getPagePreview = useCallback((pageNumber: number) => pagePreviewMap.get(pageNumber) || "", [pagePreviewMap]);

  // Results view
  if (images.length > 0) {
    return (
      <div className="page-enter max-w-5xl mx-auto space-y-8">
        <PdfPageHeader
          icon={<ImageIcon className="w-7 h-7" />}
          iconClass="tool-pdf-to-images"
          title="PDF to Images"
          description="Convert each page to high-quality images"
        />

        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border-2 border-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#2D5A3D] text-white flex items-center justify-center font-bold">
                {images.length}
              </div>
              <div>
                <p className="font-bold">Images Generated</p>
                <p className="text-xs text-muted-foreground uppercase">
                  {format} · {QUALITY_SETTINGS[quality].label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleDownloadAll} className="btn-success">
                <DownloadIcon className="w-5 h-5" />
                Download ZIP
              </button>
              <button type="button" onClick={handleStartOver} className="btn-secondary">
                Back
              </button>
              <button type="button" onClick={handleNewFile} className="btn-secondary">
                New File
              </button>
            </div>
          </div>

          {/* Image Grid */}
          <div className="border-2 border-foreground bg-card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image) => (
                <div
                  key={image.pageNumber}
                  className="group relative bg-white border-2 border-foreground/30 hover:border-foreground overflow-hidden transition-colors"
                >
                  <img
                    src={image.dataUrl}
                    alt={`Page ${image.pageNumber}`}
                    className="w-full h-auto block"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(image)}
                      className="p-2 bg-white rounded hover:scale-110 transition-transform"
                      title="Download"
                    >
                      <DownloadIcon className="w-5 h-5 text-black" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs font-mono py-1 px-2 flex items-center justify-between">
                    <span>{image.pageNumber}</span>
                    <span className="text-white/60 text-[10px]">.{format}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Processing view
  if (isProcessing) {
    return (
      <div className="page-enter max-w-5xl mx-auto space-y-8">
        <PdfPageHeader
          icon={<ImageIcon className="w-7 h-7" />}
          iconClass="tool-pdf-to-images"
          title="PDF to Images"
          description="Convert each page to high-quality images"
        />

        <div className="max-w-md mx-auto border-2 border-foreground p-8 bg-card">
          <div className="flex flex-col items-center justify-center gap-4">
            <LoaderIcon className="w-10 h-10" />
            <div className="text-center">
              <p className="font-bold text-lg">Converting pages...</p>
              <p className="text-sm text-muted-foreground">
                {selectedCount} pages · {format.toUpperCase()}
              </p>
            </div>
            <div className="w-full h-3 bg-muted border-2 border-foreground">
              <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm font-mono">{progress}%</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<ImageIcon className="w-7 h-7" />}
        iconClass="tool-pdf-to-images"
        title="PDF to Images"
        description="Convert each page to high-quality images"
      />

      {!file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          <div className="border-2 border-foreground/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-4 bg-foreground" />
              <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">How it works</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="font-bold">Upload PDF</p>
                  <p className="text-muted-foreground text-xs">See all pages</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                  2
                </div>
                <div>
                  <p className="font-bold">Select Pages</p>
                  <p className="text-muted-foreground text-xs">Choose which to export</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                  3
                </div>
                <div>
                  <p className="font-bold">Download</p>
                  <p className="text-muted-foreground text-xs">Get images as ZIP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<PdfIcon className="w-5 h-5" />}
          />

          {pagesLoading ? (
            <div className="border-2 border-foreground bg-card p-12 text-center">
              <LoaderIcon className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">Loading pages...</p>
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="flex items-center justify-between p-3 border-2 border-foreground/30 bg-muted/30">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span>
                    <span className="font-bold">{selectedCount}</span> of {pages.length} selected
                  </span>
                  {rotatedCount > 0 && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-bold">{rotatedCount} rotated</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAll} className="text-xs font-bold text-primary hover:underline">
                    All
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button type="button" onClick={selectNone} className="text-xs font-bold text-primary hover:underline">
                    None
                  </button>
                </div>
              </div>

              {/* Page grid */}
              <div className="border-2 border-foreground bg-card p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {pageItems.map((item) => (
                    <div key={item.id} className="group relative">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePage(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            togglePage(item.id);
                          }
                        }}
                        className={`relative border-2 overflow-hidden cursor-pointer transition-all ${
                          item.selected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-foreground/20 opacity-50 hover:opacity-75"
                        }`}
                      >
                        {/* Page preview */}
                        <div className="aspect-[3/4] bg-white overflow-hidden">
                          <img
                            src={getPagePreview(item.pageNumber)}
                            alt={`Page ${item.pageNumber}`}
                            className="w-full h-full object-contain transition-transform"
                            style={{ transform: `rotate(${item.rotation}deg)` }}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </div>

                        {/* Selected checkmark */}
                        {item.selected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <CheckIcon className="w-3 h-3 text-white" />
                          </div>
                        )}

                        {/* Rotate button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            rotatePage(item.id);
                          }}
                          className="absolute top-1 left-1 p-1 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                          title="Rotate 90°"
                        >
                          <RotateIcon className="w-3 h-3 text-white" />
                        </button>

                        {/* Bottom bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs py-1 px-2 text-center font-mono">
                          {item.pageNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings panel */}
              <div className="border-2 border-foreground overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-foreground flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span className="font-bold tracking-wide">SETTINGS</span>
                    <span className="text-sm text-muted-foreground">
                      {format.toUpperCase()} · {QUALITY_SETTINGS[quality].label}
                    </span>
                  </div>
                  <ChevronDownIcon className={`w-5 h-5 transition-transform ${showSettings ? "rotate-180" : ""}`} />
                </button>

                {showSettings && (
                  <div className="p-4 border-t-2 border-foreground space-y-4">
                    {/* Format */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-foreground" />
                        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Format</span>
                      </div>
                      <div className="flex gap-2">
                        {(["jpeg", "png"] as ImageFormat[]).map((f) => (
                          <button
                            type="button"
                            key={f}
                            onClick={() => setFormat(f)}
                            className={`px-4 py-2 text-sm font-bold border-2 transition-colors ${
                              format === f
                                ? "border-foreground bg-foreground text-background"
                                : "border-foreground/30 hover:border-foreground"
                            }`}
                          >
                            {f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quality */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-foreground" />
                        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
                          Quality
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {(["low", "medium", "high"] as ImageQuality[]).map((q) => (
                          <button
                            type="button"
                            key={q}
                            onClick={() => setQuality(q)}
                            className={`px-4 py-2 text-sm font-bold border-2 transition-colors ${
                              quality === q
                                ? "border-foreground bg-foreground text-background"
                                : "border-foreground/30 hover:border-foreground"
                            }`}
                          >
                            {QUALITY_SETTINGS[q].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && <ErrorBox message={error} />}

              {/* Convert button */}
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing || selectedCount === 0}
                className="btn-success w-full"
              >
                <ImageIcon className="w-5 h-5" />
                Convert {selectedCount} {selectedCount === 1 ? "Page" : "Pages"} to {format.toUpperCase()}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

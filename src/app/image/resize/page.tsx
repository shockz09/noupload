"use client";

import { useCallback, useMemo, useState } from "react";
import { DownloadIcon, LoaderIcon } from "@/components/icons/ui";
import { ImageIcon, ResizeIcon } from "@/components/icons/image";
import { ComparisonDisplay, ErrorBox, ImagePageHeader, ProgressBar, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileBuffer, useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import {
  copyImageToClipboard,
  downloadImage,
  formatFileSize,
  getImageDimensions,
  getOutputFilename,
  resizeImage,
} from "@/lib/image-utils";

interface ResizeMetadata {
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
}

interface FileItem {
  id: string;
  file: File;
}

interface ResizedItem {
  original: File;
  blob: Blob;
  filename: string;
}

const presets = [
  { label: "Instagram", width: 1080, height: 1080 },
  { label: "Twitter", width: 1200, height: 675 },
  { label: "Facebook", width: 820, height: 312 },
  { label: "HD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Thumbnail", width: 300, height: 300 },
];

export default function ImageResizePage() {
  const [width, setWidth] = useState<number>(1920);
  const [height, setHeight] = useState<number>(1080);
  const [maintainAspect, setMaintainAspect] = useState(true);

  // Single file state
  const [file, setFile] = useState<File | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<ResizeMetadata>();

  // Multi file state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<ResizedItem[]>([]);

  const isMulti = files.length > 1 || (files.length > 0 && !file);

  // --- File selection ---

  const handleFilesSelected = useCallback(
    async (newFiles: File[]) => {
      if (newFiles.length === 1 && files.length === 0) {
        // Single file path
        const selectedFile = newFiles[0];
        setFile(selectedFile);
        clearResult();
        setPreview(selectedFile);
        const dims = await getImageDimensions(selectedFile);
        setOriginalDimensions(dims);
        setWidth(dims.width);
        setHeight(dims.height);
      } else {
        // Multi file path
        setFile(null);
        revokePreview();
        clearResult();
        setOriginalDimensions(null);
        const items = newFiles.map((f) => ({ id: crypto.randomUUID(), file: f }));
        setFiles((prev) => [...prev, ...items]);
        setBulkError(null);
        setBulkResults([]);
      }
    },
    [files.length, clearResult, setPreview, revokePreview],
  );

  useImagePaste(handleFilesSelected, !result && bulkResults.length === 0);

  // --- Dimension handlers ---

  const handleWidthChange = useCallback(
    (newWidth: number) => {
      setWidth(newWidth);
      if (maintainAspect && originalDimensions) {
        setHeight(Math.round(newWidth / (originalDimensions.width / originalDimensions.height)));
      }
    },
    [maintainAspect, originalDimensions],
  );

  const handleHeightChange = useCallback(
    (newHeight: number) => {
      setHeight(newHeight);
      if (maintainAspect && originalDimensions) {
        setWidth(Math.round(newHeight * (originalDimensions.width / originalDimensions.height)));
      }
    },
    [maintainAspect, originalDimensions],
  );

  const applyPreset = useCallback((preset: { width: number; height: number }) => {
    setMaintainAspect(false);
    setWidth(preset.width);
    setHeight(preset.height);
  }, []);

  // --- Single file resize ---

  const handleResize = useCallback(async () => {
    if (!file || !originalDimensions) return;
    if (!startProcessing()) return;
    try {
      const resized = await resizeImage(file, width, height, false);
      setResult(resized, getOutputFilename(file.name, undefined, `_${width}x${height}`), {
        originalDimensions,
        newDimensions: { width, height },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to resize image"));
    } finally {
      stopProcessing();
    }
  }, [file, originalDimensions, width, height, startProcessing, setResult, setError, stopProcessing]);

  // --- Multi file resize ---

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleBulkResize = useCallback(async () => {
    if (files.length === 0) return;
    setBulkProcessing(true);
    setBulkError(null);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: files.length });

    const resized: ResizedItem[] = [];
    const BATCH_SIZE = 5;

    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async ({ file: f }) => {
            const blob = await resizeImage(f, width, height, maintainAspect);
            return { original: f, blob, filename: getOutputFilename(f.name, undefined, `_${width}x${height}`) };
          }),
        );
        resized.push(...batchResults);
        setBulkProgress({ current: Math.min(i + BATCH_SIZE, files.length), total: files.length });
      }
      setBulkResults(resized);
    } catch (err) {
      setBulkError(getErrorMessage(err, "Failed to resize images"));
    } finally {
      setBulkProcessing(false);
    }
  }, [files, width, height, maintainAspect]);

  const handleDownloadOne = useCallback((item: ResizedItem) => downloadImage(item.blob, item.filename), []);
  const handleDownloadAll = useCallback(() => {
    for (const item of bulkResults) downloadImage(item.blob, item.filename);
  }, [bulkResults]);

  // --- Shared handlers ---

  const handleClearSingle = useCallback(() => {
    revokePreview();
    setFile(null);
    setOriginalDimensions(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    setOriginalDimensions(null);
    clearResult();
    setFiles([]);
    setBulkResults([]);
    setBulkError(null);
  }, [revokePreview, clearResult]);

  const handleSingleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      download();
    },
    [download],
  );

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: result.blob.type,
      size: result.blob.size,
      fileType: "image",
      sourceToolLabel: "Resize Image",
    });
  }, [result, addToBuffer]);

  const outputPercentage = useMemo(() => {
    if (!originalDimensions) return 100;
    return Math.round(((width * height) / (originalDimensions.width * originalDimensions.height)) * 100);
  }, [width, height, originalDimensions]);

  // --- Shared controls ---
  const dimensionControls = (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Presets</span>
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 text-xs font-bold border-2 border-foreground/30 hover:border-foreground hover:bg-foreground hover:text-background transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Custom Size</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={width}
            onChange={(e) => (isMulti ? setWidth(Number(e.target.value)) : handleWidthChange(Number(e.target.value)))}
            min={1}
            max={10000}
            className="w-24 px-2 py-1.5 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
          />
          <span className="text-muted-foreground font-bold">×</span>
          <input
            type="number"
            value={height}
            onChange={(e) => (isMulti ? setHeight(Number(e.target.value)) : handleHeightChange(Number(e.target.value)))}
            min={1}
            max={10000}
            className="w-24 px-2 py-1.5 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={maintainAspect}
            onChange={(e) => setMaintainAspect(e.target.checked)}
            className="w-4 h-4 border-2 border-foreground"
          />
          <span className="text-xs font-medium">Lock aspect ratio</span>
        </label>
      </div>
    </div>
  );

  // --- Bulk results view ---
  if (bulkResults.length > 0) {
    return (
      <div className="page-enter max-w-4xl mx-auto space-y-8">
        <ImagePageHeader
          icon={<ResizeIcon className="w-7 h-7" />}
          iconClass="tool-resize"
          title="Resize Image"
          description="Change image dimensions with presets or custom sizes"
        />
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Done</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">{bulkResults.length} Images Resized!</h2>
              <p className="text-muted-foreground">All resized to {width}×{height}</p>
            </div>
            <button type="button" onClick={handleDownloadAll} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download All ({bulkResults.length} files)
            </button>
          </div>

          <div className="space-y-2">
            {bulkResults.map((item) => (
              <div key={item.filename} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{item.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(item.blob.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadOne(item)}
                  className="text-sm font-bold text-primary hover:underline ml-4"
                >
                  Download
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Resize More Images
          </button>
        </div>
      </div>
    );
  }

  // --- Single result view ---
  if (result) {
    return (
      <div className="page-enter max-w-4xl mx-auto space-y-8">
        <ImagePageHeader
          icon={<ResizeIcon className="w-7 h-7" />}
          iconClass="tool-resize"
          title="Resize Image"
          description="Change image dimensions with presets or custom sizes"
        />
        <SuccessCard
          stampText="Resized"
          title="Image Resized!"
          downloadLabel="Download Image"
          onDownload={handleSingleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Resize Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={`${result.metadata?.originalDimensions.width}×${result.metadata?.originalDimensions.height}`}
            newLabel="New Size"
            newValue={`${result.metadata?.newDimensions.width}×${result.metadata?.newDimensions.height}`}
          />
          <p className="text-sm text-muted-foreground">File size: {formatFileSize(result.blob.size)}</p>
        </SuccessCard>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ResizeIcon className="w-7 h-7" />}
        iconClass="tool-resize"
        title="Resize Image"
        description="Change image dimensions with presets or custom sizes"
      />

      {/* No files selected */}
      {!file && files.length === 0 ? (
        <div className="max-w-2xl mx-auto">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp"
            multiple={true}
            maxFiles={50}
            onFilesSelected={handleFilesSelected}
            title="Drop your images here"
            subtitle="Single or multiple files · Ctrl+V to paste"
          />
        </div>
      ) : isMulti ? (
        /* Multiple files */
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp"
            multiple={true}
            maxFiles={50}
            onFilesSelected={handleFilesSelected}
            title="Add more images"
            subtitle="Drop or click to add"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="input-label">{files.length} files selected</span>
              <button
                type="button"
                onClick={handleStartOver}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-foreground p-2">
              {files.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ImageIcon className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate">{item.file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(item.id)}
                    className="text-xs text-muted-foreground hover:text-foreground ml-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {dimensionControls}

          {bulkError && <ErrorBox message={bulkError} />}
          {bulkProcessing && (
            <ProgressBar
              progress={(bulkProgress.current / bulkProgress.total) * 100}
              label={`Resizing ${bulkProgress.current} of ${bulkProgress.total}...`}
            />
          )}

          <button
            type="button"
            onClick={handleBulkResize}
            disabled={bulkProcessing || files.length === 0}
            className="btn-primary w-full"
          >
            {bulkProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Resizing...
              </>
            ) : (
              <>
                <ResizeIcon className="w-5 h-5" />
                Resize {files.length} Images to {width}×{height}
              </>
            )}
          </button>
        </div>
      ) : (
        /* Single file — side-by-side layout */
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</span>
              <button
                type="button"
                onClick={handleClearSingle}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px]">
              <img src={preview!} alt="Preview" className="max-h-[180px] object-contain" loading="lazy" decoding="async" />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file!.name} • {originalDimensions?.width}×{originalDimensions?.height}
            </p>
          </div>

          <div className="space-y-4">
            {dimensionControls}

            {originalDimensions && (
              <div className="p-3 bg-muted/50 border border-foreground/10">
                <p className="text-xs text-muted-foreground">
                  Output: <span className="font-bold text-foreground">{width}×{height}</span>
                  <span className="ml-2">({outputPercentage}% of original)</span>
                </p>
              </div>
            )}

            {error && <ErrorBox message={error} />}

            <button type="button" onClick={handleResize} disabled={isProcessing} className="btn-primary w-full">
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Resizing...
                </>
              ) : (
                <>
                  <ResizeIcon className="w-5 h-5" />
                  Resize to {width}×{height}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

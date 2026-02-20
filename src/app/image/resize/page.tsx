"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { ResizeIcon } from "@/components/icons/image";
import { ComparisonDisplay, ErrorBox, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import {
  copyImageToClipboard,
  formatFileSize,
  getImageDimensions,
  getOutputFilename,
  resizeImage,
} from "@/lib/image-utils";

interface ResizeMetadata {
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
}

const presets = [
  { label: "Instagram", width: 1080, height: 1080 },
  { label: "Twitter", width: 1200, height: 675 },
  { label: "Facebook", width: 820, height: 312 },
  { label: "HD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
];

export default function ImageResizePage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const [maintainAspect, setMaintainAspect] = useState(true);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<ResizeMetadata>();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();
        setPreview(selectedFile);
        const dims = await getImageDimensions(selectedFile);
        setOriginalDimensions(dims);
        setWidth(dims.width);
        setHeight(dims.height);
      }
    },
    [clearResult, setPreview],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setOriginalDimensions(null);
    clearResult();
  }, [revokePreview, clearResult]);

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

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    setOriginalDimensions(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleMaintainAspectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMaintainAspect(e.target.checked);
  }, []);

  const outputPercentage = useMemo(() => {
    if (!originalDimensions) return 100;
    return Math.round(((width * height) / (originalDimensions.width * originalDimensions.height)) * 100);
  }, [width, height, originalDimensions]);

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ResizeIcon className="w-7 h-7" />}
        iconClass="tool-resize"
        title="Resize Image"
        description="Change image dimensions with presets or custom sizes"
      />

      {result ? (
        <SuccessCard
          stampText="Resized"
          title="Image Resized!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
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
      ) : !file ? (
        <FileDropzone
          accept=".jpg,.jpeg,.png,.webp"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your image here"
          subtitle="or click to browse · Ctrl+V to paste"
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px]">
              <img
                src={preview!}
                alt="Preview"
                className="max-h-[180px] object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file.name} • {originalDimensions?.width}×{originalDimensions?.height}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Presets */}
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

            {/* Custom Size */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Custom Size</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-24 px-2 py-1.5 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
                />
                <span className="text-muted-foreground font-bold">×</span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-24 px-2 py-1.5 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
              <span className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintainAspect}
                  onChange={handleMaintainAspectChange}
                  className="w-4 h-4 border-2 border-foreground"
                />
                <span className="text-xs font-medium">Lock aspect ratio</span>
              </span>
            </div>

            {/* Output Info */}
            <div className="p-3 bg-muted/50 border border-foreground/10">
              <p className="text-xs text-muted-foreground">
                Output:{" "}
                <span className="font-bold text-foreground">
                  {width}×{height}
                </span>
                {originalDimensions && <span className="ml-2">({outputPercentage}% of original)</span>}
              </p>
            </div>

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
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

"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { resizeImage, downloadImage, formatFileSize, getOutputFilename, getImageDimensions } from "@/lib/image-utils";
import { ResizeIcon, ImageIcon } from "@/components/icons";
import {
  ImagePageHeader,
  ErrorBox,
  ProgressBar,
  ProcessButton,
  SuccessCard,
  ImageFileInfo,
  ComparisonDisplay,
} from "@/components/image/shared";

interface ResizeResult {
  blob: Blob;
  filename: string;
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
}

const presets = [
  { label: "Instagram Square", width: 1080, height: 1080 },
  { label: "Instagram Portrait", width: 1080, height: 1350 },
  { label: "Twitter Post", width: 1200, height: 675 },
  { label: "Facebook Cover", width: 820, height: 312 },
  { label: "HD (1920×1080)", width: 1920, height: 1080 },
  { label: "4K (3840×2160)", width: 3840, height: 2160 },
];

export default function ImageResizePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResizeResult | null>(null);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      const dims = await getImageDimensions(selectedFile);
      setOriginalDimensions(dims);
      setWidth(dims.width);
      setHeight(dims.height);
    }
  }, []);

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setOriginalDimensions(null);
    setError(null);
    setResult(null);
  }, [preview]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFileSelected([file]);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileSelected]);

  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth);
    if (maintainAspect && originalDimensions) {
      const aspectRatio = originalDimensions.width / originalDimensions.height;
      setHeight(Math.round(newWidth / aspectRatio));
    }
  };

  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight);
    if (maintainAspect && originalDimensions) {
      const aspectRatio = originalDimensions.width / originalDimensions.height;
      setWidth(Math.round(newHeight * aspectRatio));
    }
  };

  const applyPreset = (preset: { width: number; height: number }) => {
    setMaintainAspect(false);
    setWidth(preset.width);
    setHeight(preset.height);
  };

  const handleResize = async () => {
    if (!file || !originalDimensions) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const resized = await resizeImage(file, width, height, false);
      setProgress(90);

      setResult({
        blob: resized,
        filename: getOutputFilename(file.name, undefined, `_${width}x${height}`),
        originalDimensions,
        newDimensions: { width, height },
      });

      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resize image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (result) downloadImage(result.blob, result.filename);
  };

  const handleStartOver = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setOriginalDimensions(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
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
          onStartOver={handleStartOver}
          startOverLabel="Resize Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={`${result.originalDimensions.width}×${result.originalDimensions.height}`}
            newLabel="New Size"
            newValue={`${result.newDimensions.width}×${result.newDimensions.height}`}
          />
          <p className="text-sm text-muted-foreground">
            File size: {formatFileSize(result.blob.size)}
          </p>
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
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img src={preview} alt="Preview" className="max-h-48 mx-auto object-contain" />
              {originalDimensions && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Original: {originalDimensions.width}×{originalDimensions.height}
                </p>
              )}
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          <div className="space-y-3">
            <label className="input-label">Quick Presets</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-2 text-xs font-bold border-2 border-foreground hover:bg-foreground hover:text-background transition-colors text-left"
                >
                  <span className="block">{preset.label}</span>
                  <span className="text-muted-foreground">{preset.width}×{preset.height}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="input-label">Custom Size</label>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Width</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="input-field w-full"
                />
              </div>
              <div className="pt-6 text-muted-foreground font-bold">×</div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Height</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="input-field w-full"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={maintainAspect}
                onChange={(e) => setMaintainAspect(e.target.checked)}
                className="w-5 h-5 border-2 border-foreground bg-background checked:bg-foreground"
              />
              <span className="text-sm font-medium">Maintain aspect ratio</span>
            </label>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Resizing..." />}

          <ProcessButton
            onClick={handleResize}
            isProcessing={isProcessing}
            processingLabel="Resizing..."
            icon={<ResizeIcon className="w-5 h-5" />}
            label={`Resize to ${width}×${height}`}
          />
        </div>
      )}
    </div>
  );
}

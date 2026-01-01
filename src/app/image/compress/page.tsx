"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { compressImage, downloadImage, copyImageToClipboard, formatFileSize, getOutputFilename } from "@/lib/image-utils";
import { ImageCompressIcon, ImageIcon } from "@/components/icons";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import {
  ImagePageHeader,
  ErrorBox,
  ProgressBar,
  ProcessButton,
  SuccessCard,
  ImageFileInfo,
  ComparisonDisplay,
  SavingsBadge,
} from "@/components/image/shared";

interface CompressResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

export default function ImageCompressPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const processingRef = useRef(false);

  const processFile = useCallback(async (fileToProcess: File, q: number) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const compressed = await compressImage(fileToProcess, q / 100);
      setProgress(90);
      setResult({
        blob: compressed,
        filename: getOutputFilename(fileToProcess.name, "jpeg", "_compressed"),
        originalSize: fileToProcess.size,
        compressedSize: compressed.size,
      });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compress image");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, []);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      if (isInstant) {
        processFile(selectedFile, 80);
      }
    }
  }, [isInstant, processFile]);

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
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

  const handleCompress = async () => {
    if (!file) return;
    processFile(file, quality);
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
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ImageCompressIcon className="w-7 h-7" />}
        iconClass="tool-image-compress"
        title="Compress Image"
        description="Reduce file size while keeping quality"
      />

      {result ? (
        <SuccessCard
          stampText="Optimized"
          title="Image Compressed!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={formatFileSize(result.originalSize)}
            newLabel="Compressed"
            newValue={formatFileSize(result.compressedSize)}
          />
          <SavingsBadge savings={savings} />
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your image here"
            subtitle="or click to browse · Ctrl+V to paste"
          />
          <div className="info-box">
            <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">{isInstant ? "Instant compression" : "About compression"}</p>
              <p className="text-muted-foreground">
                {isInstant
                  ? "Drop an image and it will be compressed at 80% quality automatically."
                  : "Compresses images using JPEG encoding. Adjust the quality slider to balance file size and visual quality."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img src={preview} alt="Preview" className="max-h-64 mx-auto object-contain" />
            </div>
          )}

          <ImageFileInfo file={file} fileSize={formatFileSize(file.size)} onClear={handleClear} icon={<ImageIcon className="w-5 h-5" />} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="input-label">Quality</label>
              <span className="text-sm font-bold">{quality}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Compressing..." />}

          <ProcessButton
            onClick={handleCompress}
            isProcessing={isProcessing}
            processingLabel="Compressing..."
            icon={<ImageCompressIcon className="w-5 h-5" />}
            label="Compress Image"
          />
        </div>
      )}
    </div>
  );
}

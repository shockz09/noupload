"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { convertHeicToJpeg, downloadImage, formatFileSize } from "@/lib/image-utils";
import { HeicIcon, ImageIcon } from "@/components/icons";
import {
  ImagePageHeader,
  ErrorBox,
  ProgressBar,
  ProcessButton,
  SuccessCard,
  ImageFileInfo,
  ComparisonDisplay,
} from "@/components/image/shared";

interface ConvertResult {
  blob: Blob;
  filename: string;
  originalSize: number;
}

export default function HeicToJpegPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
  }, []);

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(20);
      const converted = await convertHeicToJpeg(file);
      setProgress(90);

      const baseName = file.name.replace(/\.heic$/i, "").replace(/\.heif$/i, "");

      setResult({
        blob: converted,
        filename: `${baseName}.jpg`,
        originalSize: file.size,
      });

      setProgress(100);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to convert HEIC. Make sure the file is a valid HEIC image."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (result) {
      downloadImage(result.blob, result.filename);
    }
  };

  const handleStartOver = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<HeicIcon className="w-7 h-7" />}
        iconClass="tool-heic"
        title="HEIC → JPEG"
        description="Convert iPhone photos to standard JPEG format"
      />

      {result ? (
        <SuccessCard
          stampText="Converted"
          title="HEIC Converted!"
          downloadLabel="Download JPEG"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue="HEIC"
            newLabel="Converted"
            newValue="JPEG"
          />
          <p className="text-sm text-muted-foreground">
            {formatFileSize(result.originalSize)} → {formatFileSize(result.blob.size)}
          </p>
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".heic,.heif"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your HEIC file here"
            subtitle="or click to browse from your device"
          />

          <div className="info-box">
            <svg
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
              <p className="font-bold text-foreground mb-1">About HEIC</p>
              <p className="text-muted-foreground">
                HEIC (High Efficiency Image Format) is used by iPhones for
                photos. Convert them to JPEG for universal compatibility with
                any device or application.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          {error && <ErrorBox message={error} />}

          {isProcessing && <ProgressBar progress={progress} label="Converting HEIC..." />}

          <ProcessButton
            onClick={handleConvert}
            isProcessing={isProcessing}
            processingLabel="Converting..."
            icon={<HeicIcon className="w-5 h-5" />}
            label="Convert to JPEG"
          />
        </div>
      )}
    </div>
  );
}

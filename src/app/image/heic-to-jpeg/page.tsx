"use client";

import { useCallback, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { HeicIcon, ImageIcon } from "@/components/icons/image";
import { ComparisonDisplay, ErrorBox, ImageFileInfo, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { convertHeicToJpeg } from "@/lib/heic-utils";
import { copyImageToClipboard, downloadImage, formatFileSize } from "@/lib/image-utils";

interface ConvertResult {
  blob: Blob;
  filename: string;
  originalSize: number;
}

export default function HeicToJpegPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);

  // Use custom hook for processing state
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        setProgress(20);
        const converted = await convertHeicToJpeg(fileToProcess);
        setProgress(90);

        const baseName = fileToProcess.name.replace(/\.heic$/i, "").replace(/\.heif$/i, "");
        setResult({
          blob: converted,
          filename: `${baseName}.jpg`,
          originalSize: fileToProcess.size,
        });
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to convert HEIC."));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearError();
        setResult(null);
        if (isInstant) {
          processFile(selectedFile);
        }
      }
    },
    [isInstant, processFile, clearError],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (result) downloadImage(result.blob, result.filename);
    },
    [result],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setResult(null);
  }, [clearError]);

  if (!isLoaded) return null;

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
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleClear}
          startOverLabel="Convert Another"
        >
          <ComparisonDisplay originalLabel="Original" originalValue="HEIC" newLabel="Converted" newValue="JPEG" />
          <p className="text-sm text-muted-foreground">
            {formatFileSize(result.originalSize)} → {formatFileSize(result.blob.size)}
          </p>
        </SuccessCard>
      ) : isProcessing ? (
        <div className="border-2 border-foreground p-12 bg-card">
          <div className="flex flex-col items-center justify-center gap-4">
            <LoaderIcon className="w-8 h-8 animate-spin" />
            <div className="text-center">
              <p className="font-bold">Converting to JPEG...</p>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
            </div>
            <div className="w-full max-w-xs h-2 bg-muted border-2 border-foreground">
              <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorBox message={error} />
          <button type="button" onClick={handleClear} className="btn-secondary w-full">
            Try Again
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".heic,.heif"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your HEIC file here"
            subtitle="or click to browse from your device"
          />
          <InfoBox title={isInstant ? "Instant conversion" : "Manual mode"}>
            {isInstant
              ? "Drop a HEIC file and it will be converted automatically."
              : "Drop a HEIC file, then click to convert."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />
          <button
            type="button"
            onClick={() => processFile(file)}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            <HeicIcon className="w-5 h-5" />
            Convert to JPEG
          </button>
        </div>
      )}
    </div>
  );
}

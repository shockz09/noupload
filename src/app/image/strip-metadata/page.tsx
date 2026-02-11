"use client";

import { useCallback, useMemo, useState } from "react";
import { ImageIcon, LoaderIcon, MetadataIcon, ShieldIcon } from "@/components/icons";
import { ErrorBox, ImageFileInfo, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { copyImageToClipboard, formatFileSize, getOutputFilename, stripMetadata } from "@/lib/image-utils";

interface StripMetadata {
  originalSize: number;
}

export default function StripMetadataPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<StripMetadata>();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;

      try {
        const stripped = await stripMetadata(fileToProcess);
        setResult(stripped, getOutputFilename(fileToProcess.name, undefined, "_clean"), {
          originalSize: fileToProcess.size,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to strip metadata");
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setResult, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();
        setPreview(selectedFile);

        if (isInstant) {
          processFile(selectedFile);
        }
      }
    },
    [isInstant, processFile, clearResult, setPreview],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    clearResult();
  }, [revokePreview, clearResult]);

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
    clearResult();
  }, [revokePreview, clearResult]);

  const handleProcess = useCallback(() => {
    if (file) processFile(file);
  }, [file, processFile]);

  const showProcessingState = useMemo(() => isProcessing && !result, [isProcessing, result]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<MetadataIcon className="w-7 h-7" />}
        iconClass="tool-strip-metadata"
        title="Strip Metadata"
        description="Remove EXIF data and GPS location from photos"
      />

      {result ? (
        <SuccessCard
          stampText="Clean"
          title="Metadata Removed!"
          downloadLabel="Download Clean Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Clean Another"
        >
          <div className="bg-muted/50 border-2 border-foreground p-4 text-left">
            <p className="font-bold text-sm mb-2">Removed data includes:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Camera make and model</li>
              <li>• GPS coordinates and location</li>
              <li>• Date and time taken</li>
              <li>• Software used</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">New file size: {formatFileSize(result.blob.size)}</p>
        </SuccessCard>
      ) : showProcessingState ? (
        <div className="border-2 border-foreground p-12 bg-card">
          <div className="flex flex-col items-center justify-center gap-4">
            <LoaderIcon className="w-8 h-8 animate-spin" />
            <div className="text-center">
              <p className="font-bold">Removing metadata...</p>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorBox message={error} />
          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Try Again
          </button>
        </div>
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
            <ShieldIcon className="w-5 h-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">{isInstant ? "Instant processing" : "Manual mode"}</p>
              <p className="text-muted-foreground">
                {isInstant
                  ? "Drop or paste an image and it will be cleaned automatically."
                  : "Drop an image, review it, then click to process."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 mx-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          <div className="bg-[#FEF3C7] border-2 border-foreground p-4">
            <div className="flex gap-3">
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-[#92400E] shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className="text-sm">
                <p className="font-bold text-[#92400E] mb-1">What will be removed</p>
                <p className="text-[#92400E]/80">
                  All EXIF metadata including camera info, GPS location, date taken, and any other embedded data.
                </p>
              </div>
            </div>
          </div>

          <button type="button" onClick={handleProcess} disabled={isProcessing} className="btn-primary w-full">
            <ShieldIcon className="w-5 h-5" />
            Remove All Metadata
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { stripMetadata, downloadImage, formatFileSize, getOutputFilename } from "@/lib/image-utils";
import { MetadataIcon, ImageIcon, ShieldIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, SuccessCard, ImageFileInfo } from "@/components/image/shared";

interface StripResult {
  blob: Blob;
  filename: string;
  originalSize: number;
}

export default function StripMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StripResult | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
    }
  }, []);

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

  const handleStrip = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const stripped = await stripMetadata(file);

      setResult({
        blob: stripped,
        filename: getOutputFilename(file.name, undefined, "_clean"),
        originalSize: file.size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to strip metadata");
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
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

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
              <li>• Other EXIF metadata</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            New file size: {formatFileSize(result.blob.size)}
          </p>
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
            <ShieldIcon className="w-5 h-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">Protect your privacy</p>
              <p className="text-muted-foreground">
                Photos from smartphones contain hidden data like GPS location,
                device info, and timestamps. Remove this data before sharing
                images online.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img src={preview} alt="Preview" className="max-h-48 mx-auto object-contain" />
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          {/* Warning */}
          <div className="bg-[#FEF3C7] border-2 border-foreground p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-[#92400E] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className="text-sm">
                <p className="font-bold text-[#92400E] mb-1">What will be removed</p>
                <p className="text-[#92400E]/80">
                  All EXIF metadata including camera info, GPS location, date
                  taken, and any other embedded data. The image quality remains
                  unchanged.
                </p>
              </div>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground py-4">
              <LoaderIcon className="w-4 h-4" />
              <span>Removing metadata...</span>
            </div>
          )}

          <button onClick={handleStrip} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <><LoaderIcon className="w-5 h-5" />Processing...</>
            ) : (
              <><ShieldIcon className="w-5 h-5" />Remove All Metadata</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

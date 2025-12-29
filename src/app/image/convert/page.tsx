"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { convertFormat, downloadImage, formatFileSize, ImageFormat } from "@/lib/image-utils";
import { ConvertIcon, ImageIcon } from "@/components/icons";
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
  originalFormat: string;
  newFormat: ImageFormat;
}

const formats: { value: ImageFormat; label: string; description: string }[] = [
  { value: "jpeg", label: "JPEG", description: "Best for photos, smaller files" },
  { value: "png", label: "PNG", description: "Lossless, supports transparency" },
  { value: "webp", label: "WebP", description: "Modern format, great compression" },
];

export default function ImageConvertPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>("jpeg");
  const [quality, setQuality] = useState(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      const url = URL.createObjectURL(selectedFile);
      setPreview(url);

      // Auto-select a different format as target
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      if (ext === "png") setTargetFormat("jpeg");
      else if (ext === "jpg" || ext === "jpeg") setTargetFormat("png");
      else if (ext === "webp") setTargetFormat("jpeg");
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

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const converted = await convertFormat(file, targetFormat, quality / 100);
      setProgress(90);

      const baseName = file.name.split(".").slice(0, -1).join(".");
      const ext = targetFormat === "jpeg" ? "jpg" : targetFormat;
      const originalExt = file.name.split(".").pop()?.toUpperCase() || "Unknown";

      setResult({
        blob: converted,
        filename: `${baseName}.${ext}`,
        originalFormat: originalExt,
        newFormat: targetFormat,
      });

      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert image");
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
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const showQualitySlider = targetFormat === "jpeg" || targetFormat === "webp";

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ConvertIcon className="w-7 h-7" />}
        iconClass="tool-convert"
        title="Convert Image"
        description="Convert between PNG, JPEG, and WebP formats"
      />

      {result ? (
        <SuccessCard
          stampText="Converted"
          title="Image Converted!"
          downloadLabel={`Download ${result.newFormat.toUpperCase()}`}
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={result.originalFormat}
            newLabel="New Format"
            newValue={result.newFormat.toUpperCase()}
          />
          <p className="text-sm text-muted-foreground">
            File size: {formatFileSize(result.blob.size)}
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
            <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">Format guide</p>
              <p className="text-muted-foreground">
                <strong>JPEG:</strong> Best for photos, smaller files.{" "}
                <strong>PNG:</strong> Lossless with transparency.{" "}
                <strong>WebP:</strong> Modern format with best compression.
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

          <div className="space-y-3">
            <label className="input-label">Convert to</label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => setTargetFormat(format.value)}
                  className={`px-4 py-3 text-sm font-bold border-2 border-foreground transition-colors ${
                    targetFormat === format.value ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  <span className="block">{format.label}</span>
                  <span className={`text-xs ${targetFormat === format.value ? "text-background/70" : "text-muted-foreground"}`}>
                    {format.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {showQualitySlider && (
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
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Converting..." />}

          <ProcessButton
            onClick={handleConvert}
            isProcessing={isProcessing}
            processingLabel="Converting..."
            icon={<ConvertIcon className="w-5 h-5" />}
            label={`Convert to ${targetFormat.toUpperCase()}`}
          />
        </div>
      )}
    </div>
  );
}

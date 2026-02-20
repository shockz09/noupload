"use client";

import { useCallback, useMemo, useState } from "react";
import { ConvertIcon, ImageIcon } from "@/components/icons/image";
import {
  ComparisonDisplay,
  ErrorBox,
  ImageFileInfo,
  ImagePageHeader,
  ProcessButton,
  ProgressBar,
  SuccessCard,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { convertFormat, copyImageToClipboard, formatFileSize, type ImageFormat } from "@/lib/image-utils";
import { getFileBaseName } from "@/lib/utils";

interface ConvertMetadata {
  originalFormat: string;
  newFormat: ImageFormat;
}

const formats: { value: ImageFormat; label: string; description: string }[] = [
  {
    value: "jpeg",
    label: "JPEG",
    description: "Best for photos, smaller files",
  },
  {
    value: "png",
    label: "PNG",
    description: "Lossless, supports transparency",
  },
  {
    value: "webp",
    label: "WebP",
    description: "Modern format, great compression",
  },
];

export default function ImageConvertPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>("jpeg");
  const [quality, setQuality] = useState(90);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<ConvertMetadata>();

  const processFile = useCallback(
    async (fileToProcess: File, format: ImageFormat, q: number) => {
      if (!startProcessing()) return;

      try {
        setProgress(30);
        const converted = await convertFormat(fileToProcess, format, q / 100);
        setProgress(90);

        const baseName = getFileBaseName(fileToProcess.name);
        const ext = format === "jpeg" ? "jpg" : format;
        const originalExt = fileToProcess.name.split(".").pop()?.toUpperCase() || "Unknown";

        setResult(converted, `${baseName}.${ext}`, { originalFormat: originalExt, newFormat: format });
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to convert image"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setResult, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();
        setPreview(selectedFile);

        // Auto-select a different format as target
        const ext = selectedFile.name.split(".").pop()?.toLowerCase();
        if (ext === "png") setTargetFormat("jpeg");
        else if (ext === "jpg" || ext === "jpeg") setTargetFormat("png");
        else if (ext === "webp") setTargetFormat("jpeg");

        if (isInstant) {
          processFile(selectedFile, "png", 100);
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

  const handleConvert = useCallback(async () => {
    if (!file) return;
    processFile(file, targetFormat, quality);
  }, [file, targetFormat, quality, processFile]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleFormatSelect = useCallback((format: ImageFormat) => {
    setTargetFormat(format);
  }, []);

  const handleQualityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuality(Number(e.target.value));
  }, []);

  const showQualitySlider = useMemo(() => targetFormat === "jpeg" || targetFormat === "webp", [targetFormat]);

  if (!isLoaded) return null;

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
          downloadLabel={`Download ${result.metadata?.newFormat.toUpperCase()}`}
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={result.metadata?.originalFormat ?? ""}
            newLabel="New Format"
            newValue={result.metadata?.newFormat.toUpperCase() ?? ""}
          />
          <p className="text-sm text-muted-foreground">File size: {formatFileSize(result.blob.size)}</p>
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

          <InfoBox title={isInstant ? "Instant conversion" : "Format guide"}>
            {isInstant
              ? "Drop an image and it will be converted to PNG automatically."
              : "JPEG: Best for photos. PNG: Lossless with transparency. WebP: Modern format."}
          </InfoBox>
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

          <div className="space-y-3">
            <span className="input-label">Convert to</span>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((format) => (
                <button
                  type="button"
                  key={format.value}
                  onClick={() => handleFormatSelect(format.value)}
                  className={`px-4 py-3 text-sm font-bold border-2 border-foreground transition-colors ${
                    targetFormat === format.value ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  <span className="block">{format.label}</span>
                  <span
                    className={`text-xs ${targetFormat === format.value ? "text-background/70" : "text-muted-foreground"}`}
                  >
                    {format.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {showQualitySlider && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="input-label">Quality</span>
                <span className="text-sm font-bold">{quality}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={handleQualityChange}
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

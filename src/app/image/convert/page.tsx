"use client";

import { useCallback, useState } from "react";
import { DownloadIcon, LoaderIcon } from "@/components/icons/ui";
import { ConvertIcon, ImageIcon } from "@/components/icons/image";
import {
  ErrorBox,
  ImageFileInfo,
  ImagePageHeader,
  ImageResultView,
  ProcessButton,
  ProgressBar,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { downloadMultiple } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { convertFormat, copyImageToClipboard, downloadImage, formatFileSize, type ImageFormat } from "@/lib/image-utils";
import { getFileBaseName } from "@/lib/utils";

interface ConvertMetadata {
  originalFormat: string;
  newFormat: ImageFormat;
}

interface FileItem {
  id: string;
  file: File;
}

interface ConvertedItem {
  original: File;
  blob: Blob;
  filename: string;
}

const formats: { value: ImageFormat; label: string; description: string }[] = [
  { value: "jpeg", label: "JPEG", description: "Best for photos, smaller files" },
  { value: "png", label: "PNG", description: "Lossless, supports transparency" },
  { value: "webp", label: "WebP", description: "Modern format, great compression" },
];

const FORMAT_EXT: Record<ImageFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export default function ImageConvertPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [targetFormat, setTargetFormat] = useState<ImageFormat>("jpeg");
  const [quality, setQuality] = useState(90);

  // Single file state
  const [file, setFile] = useState<File | null>(null);
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<ConvertMetadata>();

  // Multi file state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<ConvertedItem[]>([]);

  const isMulti = files.length > 1 || (files.length > 0 && !file);
  const showQualitySlider = targetFormat === "jpeg" || targetFormat === "webp";

  // --- Single file processing ---

  const processFile = useCallback(
    async (fileToProcess: File, format: ImageFormat, q: number) => {
      if (!startProcessing()) return;
      try {
        setProgress(30);
        const converted = await convertFormat(fileToProcess, format, q / 100);
        setProgress(90);
        const baseName = getFileBaseName(fileToProcess.name);
        const originalExt = fileToProcess.name.split(".").pop()?.toUpperCase() || "Unknown";
        setResult(converted, `${baseName}.${FORMAT_EXT[format]}`, { originalFormat: originalExt, newFormat: format });
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to convert image"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setResult, setError, stopProcessing],
  );

  // --- File selection ---

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      if (newFiles.length === 1 && files.length === 0) {
        // Single file path
        const selectedFile = newFiles[0];
        setFile(selectedFile);
        clearResult();

        const ext = selectedFile.name.split(".").pop()?.toLowerCase();
        const isHeic = ext === "heic" || ext === "heif";
        if (!isHeic) setPreview(selectedFile);

        let autoFormat: ImageFormat = "png";
        if (ext === "png") autoFormat = "jpeg";
        else if (ext === "jpg" || ext === "jpeg") autoFormat = "png";
        setTargetFormat(autoFormat);

        if (isInstant) {
          const autoQuality = autoFormat === "png" ? 100 : 90;
          processFile(selectedFile, autoFormat, autoQuality);
        }
      } else {
        // Multi file path
        setFile(null);
        revokePreview();
        clearResult();
        const items = newFiles.map((f) => ({ id: crypto.randomUUID(), file: f }));
        setFiles((prev) => [...prev, ...items]);
        setBulkError(null);
        setBulkResults([]);
      }
    },
    [files.length, isInstant, processFile, clearResult, setPreview, revokePreview],
  );

  useImagePaste(handleFilesSelected, !result && bulkResults.length === 0);

  // --- Multi file handlers ---

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleBulkConvert = useCallback(async () => {
    if (files.length === 0) return;
    setBulkProcessing(true);
    setBulkError(null);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: files.length });

    const converted: ConvertedItem[] = [];
    const ext = FORMAT_EXT[targetFormat];
    const BATCH_SIZE = 5;

    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async ({ file: f }) => {
            const blob = await convertFormat(f, targetFormat, quality / 100);
            return { original: f, blob, filename: `${getFileBaseName(f.name)}.${ext}` };
          }),
        );
        converted.push(...batchResults);
        setBulkProgress({ current: Math.min(i + BATCH_SIZE, files.length), total: files.length });
      }
      setBulkResults(converted);
    } catch (err) {
      setBulkError(getErrorMessage(err, "Failed to convert images"));
    } finally {
      setBulkProcessing(false);
    }
  }, [files, targetFormat, quality]);

  const handleDownloadOne = useCallback((item: ConvertedItem) => downloadImage(item.blob, item.filename), []);
  const handleDownloadAll = useCallback(() => {
    downloadMultiple(
      bulkResults.map((item) => ({ data: item.blob, filename: item.filename })),
      "converted_images.zip",
    );
  }, [bulkResults]);

  // --- Shared handlers ---

  const handleClearSingle = useCallback(() => {
    revokePreview();
    setFile(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    clearResult();
    setFiles([]);
    setBulkResults([]);
    setBulkError(null);
  }, [revokePreview, clearResult]);

  const handleSingleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
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
      sourceToolLabel: "Convert Image",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  // --- Bulk results view ---
  if (bulkResults.length > 0) {
    return (
      <div className="page-enter max-w-2xl mx-auto space-y-8">
        <ImagePageHeader
          icon={<ConvertIcon className="w-7 h-7" />}
          iconClass="tool-convert"
          title="Convert Image"
          description="Convert between PNG, JPEG, WebP · SVG to raster"
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
              <h2 className="text-3xl font-display">{bulkResults.length} Images Converted!</h2>
              <p className="text-muted-foreground">All converted to {targetFormat.toUpperCase()}</p>
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
            Convert More Images
          </button>
        </div>
      </div>
    );
  }

  // --- Single result view ---
  if (result) {
    return (
      <div className="page-enter max-w-2xl mx-auto space-y-8">
        <ImagePageHeader
          icon={<ConvertIcon className="w-7 h-7" />}
          iconClass="tool-convert"
          title="Convert Image"
          description="Convert between PNG, JPEG, WebP · SVG to raster"
        />
        <ImageResultView
          blob={result.blob}
          title="Image Converted!"
          subtitle={`${result.metadata?.originalFormat ?? ""} → ${result.metadata?.newFormat.toUpperCase() ?? ""}`}
          downloadLabel={`Download ${result.metadata?.newFormat.toUpperCase()}`}
          onDownload={handleSingleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        />
      </div>
    );
  }

  // --- Format picker (shared between single and multi) ---
  const formatPicker = (
    <div className="space-y-3">
      <span className="input-label">Convert to</span>
      <div className="grid grid-cols-3 gap-2">
        {formats.map((format) => (
          <button
            type="button"
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
  );

  const qualitySlider = showQualitySlider ? (
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
        onChange={(e) => setQuality(Number(e.target.value))}
        className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-xs text-muted-foreground font-medium">
        <span>Smaller file</span>
        <span>Better quality</span>
      </div>
    </div>
  ) : null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ConvertIcon className="w-7 h-7" />}
        iconClass="tool-convert"
        title="Convert Image"
        description="Convert between PNG, JPEG, WebP · SVG to raster"
      />

      {/* No files selected */}
      {!file && files.length === 0 ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.svg"
            multiple={true}
            maxFiles={50}
            onFilesSelected={handleFilesSelected}
            title="Drop your images here"
            subtitle="Single or multiple files · Ctrl+V to paste"
          />
          <InfoBox title={isInstant ? "Instant conversion" : "Format guide"}>
            {isInstant
              ? "Drop an image and it will be converted automatically. HEIC & SVG supported."
              : "JPEG: Best for photos. PNG: Lossless with transparency. WebP: Modern format. SVG → raster supported."}
          </InfoBox>
        </div>
      ) : isMulti ? (
        /* Multiple files */
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.svg"
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

          {formatPicker}
          {qualitySlider}

          {bulkError && <ErrorBox message={bulkError} />}
          {bulkProcessing && (
            <ProgressBar
              progress={(bulkProgress.current / bulkProgress.total) * 100}
              label={`Converting ${bulkProgress.current} of ${bulkProgress.total}...`}
            />
          )}

          <button
            type="button"
            onClick={handleBulkConvert}
            disabled={bulkProcessing || files.length === 0}
            className="btn-primary w-full"
          >
            {bulkProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Converting...
              </>
            ) : (
              <>
                <ConvertIcon className="w-5 h-5" />
                Convert {files.length} Images to {targetFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      ) : (
        /* Single file */
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img src={preview} alt="Preview" className="max-h-48 mx-auto object-contain" loading="lazy" decoding="async" />
            </div>
          )}

          <ImageFileInfo
            file={file!}
            fileSize={formatFileSize(file!.size)}
            onClear={handleClearSingle}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          {formatPicker}
          {qualitySlider}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Converting..." />}

          <ProcessButton
            onClick={() => { if (file) processFile(file, targetFormat, quality); }}
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

"use client";

import { useCallback, useMemo, useState } from "react";
import { DownloadIcon, LoaderIcon } from "@/components/icons/ui";
import { ImageCompressIcon, ImageIcon } from "@/components/icons/image";
import {
  ErrorBox,
  ImageFileInfo,
  ImagePageHeader,
  ImageResultView,
  ProcessButton,
  ProgressBar,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox, QualitySlider } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { compressImage, copyImageToClipboard, downloadImage, formatFileSize, getOutputFilename } from "@/lib/image-utils";

interface CompressMetadata {
  originalSize: number;
  compressedSize: number;
}

interface FileItem {
  id: string;
  file: File;
}

interface CompressedItem {
  original: File;
  blob: Blob;
  filename: string;
}

export default function ImageCompressPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [quality, setQuality] = useState(80);

  // Single file state
  const [file, setFile] = useState<File | null>(null);
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing: isSingleProcessing, progress, error: singleError, startProcessing, stopProcessing, setProgress, setError: setSingleError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<CompressMetadata>();

  // Multi file state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<CompressedItem[]>([]);

  const isMulti = files.length > 1 || (files.length > 0 && !file);

  // --- Single file handlers ---

  const processFile = useCallback(
    async (fileToProcess: File, q: number) => {
      if (!startProcessing()) return;
      try {
        setProgress(30);
        const compressed = await compressImage(fileToProcess, q / 100);
        setProgress(90);
        setResult(compressed, getOutputFilename(fileToProcess.name, "jpeg", "_compressed"), {
          originalSize: fileToProcess.size,
          compressedSize: compressed.size,
        });
        setProgress(100);
      } catch (err) {
        setSingleError(getErrorMessage(err, "Failed to compress image"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setResult, setSingleError, stopProcessing],
  );

  // --- File selection (handles both single and multi) ---

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      if (newFiles.length === 1 && files.length === 0) {
        // Single file path
        const selectedFile = newFiles[0];
        setFile(selectedFile);
        clearResult();
        setPreview(selectedFile);
        if (isInstant) processFile(selectedFile, 80);
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

  const handleBulkCompress = useCallback(async () => {
    if (files.length === 0) return;

    setBulkProcessing(true);
    setBulkError(null);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: files.length });

    const compressed: CompressedItem[] = [];
    const BATCH_SIZE = 5;

    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async ({ file: f }) => {
            const blob = await compressImage(f, quality / 100);
            return { original: f, blob, filename: getOutputFilename(f.name, "jpeg", "_compressed") };
          }),
        );
        compressed.push(...batchResults);
        setBulkProgress({ current: Math.min(i + BATCH_SIZE, files.length), total: files.length });
      }
      setBulkResults(compressed);
    } catch (err) {
      setBulkError(getErrorMessage(err, "Failed to compress images"));
    } finally {
      setBulkProcessing(false);
    }
  }, [files, quality]);

  const handleDownloadOne = useCallback((item: CompressedItem) => downloadImage(item.blob, item.filename), []);
  const handleDownloadAll = useCallback(() => {
    for (const item of bulkResults) downloadImage(item.blob, item.filename);
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
    setBulkProgress({ current: 0, total: 0 });
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
      sourceToolLabel: "Compress Image",
    });
  }, [result, addToBuffer]);

  const singleSavings = result?.metadata ? Math.round((1 - result.metadata.compressedSize / result.metadata.originalSize) * 100) : 0;

  const totalOriginalSize = useMemo(() => files.reduce((sum, f) => sum + f.file.size, 0), [files]);
  const totalSavings = useMemo(() => {
    if (bulkResults.length === 0 || totalOriginalSize === 0) return 0;
    const totalCompressed = bulkResults.reduce((sum, r) => sum + r.blob.size, 0);
    return Math.round((1 - totalCompressed / totalOriginalSize) * 100);
  }, [bulkResults, totalOriginalSize]);

  if (!isLoaded) return null;

  // --- Multi results view ---
  if (bulkResults.length > 0) {
    return (
      <div className="page-enter max-w-2xl mx-auto space-y-8">
        <ImagePageHeader
          icon={<ImageCompressIcon className="w-7 h-7" />}
          iconClass="tool-image-compress"
          title="Compress Image"
          description="Reduce file size while keeping quality"
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
              <h2 className="text-3xl font-display">{bulkResults.length} Images Compressed!</h2>
              <p className="text-sm text-muted-foreground">{totalSavings}% smaller overall</p>
            </div>
            <button type="button" onClick={handleDownloadAll} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download All ({bulkResults.length} files)
            </button>
          </div>

          <div className="space-y-2">
            {bulkResults.map((item) => {
              const savings = Math.round((1 - item.blob.size / item.original.size) * 100);
              return (
                <div key={item.filename} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(item.original.size)} → {formatFileSize(item.blob.size)} ({savings}% saved)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(item)}
                    className="text-sm font-bold text-primary hover:underline ml-4"
                  >
                    Download
                  </button>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Compress More Images
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
          icon={<ImageCompressIcon className="w-7 h-7" />}
          iconClass="tool-image-compress"
          title="Compress Image"
          description="Reduce file size while keeping quality"
        />
        <ImageResultView
          blob={result.blob}
          title="Image Compressed!"
          subtitle={`${formatFileSize(result.metadata?.originalSize ?? 0)} → ${formatFileSize(result.metadata?.compressedSize ?? 0)} · ${singleSavings}% smaller`}
          downloadLabel="Download Image"
          onDownload={handleSingleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        />
      </div>
    );
  }

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ImageCompressIcon className="w-7 h-7" />}
        iconClass="tool-image-compress"
        title="Compress Image"
        description="Reduce file size while keeping quality"
      />

      {/* No files selected — dropzone */}
      {!file && files.length === 0 ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple={true}
            maxFiles={50}
            onFilesSelected={handleFilesSelected}
            title="Drop your images here"
            subtitle="Single or multiple files · Ctrl+V to paste"
          />
          <InfoBox title={isInstant ? "Instant compression" : "About compression"}>
            {isInstant
              ? "Drop an image and it will be compressed at 80% quality automatically."
              : "Compresses images using JPEG encoding. Drop one or multiple files."}
          </InfoBox>
        </div>
      ) : isMulti ? (
        /* Multiple files selected — bulk UI */
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
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
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(item.file.size)}</span>
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
            <p className="text-xs text-muted-foreground">Total: {formatFileSize(totalOriginalSize)}</p>
          </div>

          <QualitySlider label="Quality" value={quality} onChange={setQuality} />

          {bulkError && <ErrorBox message={bulkError} />}
          {bulkProcessing && (
            <ProgressBar
              progress={(bulkProgress.current / bulkProgress.total) * 100}
              label={`Compressing ${bulkProgress.current} of ${bulkProgress.total}...`}
            />
          )}

          <button
            type="button"
            onClick={handleBulkCompress}
            disabled={bulkProcessing || files.length === 0}
            className="btn-primary w-full"
          >
            {bulkProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Compressing...
              </>
            ) : (
              <>
                <ImageCompressIcon className="w-5 h-5" />
                Compress {files.length} Images
              </>
            )}
          </button>
        </div>
      ) : (
        /* Single file selected — original UI */
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 mx-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <ImageFileInfo
            file={file!}
            fileSize={formatFileSize(file!.size)}
            onClear={handleClearSingle}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          <QualitySlider label="Quality" value={quality} onChange={setQuality} />

          {singleError && <ErrorBox message={singleError} />}
          {isSingleProcessing && <ProgressBar progress={progress} label="Compressing..." />}

          <ProcessButton
            onClick={() => processFile(file!, quality)}
            isProcessing={isSingleProcessing}
            processingLabel="Compressing..."
            icon={<ImageCompressIcon className="w-5 h-5" />}
            label="Compress Image"
          />
        </div>
      )}
    </div>
  );
}

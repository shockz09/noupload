import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/image/compress")({
	head: () => ({
		meta: [
			{ title: "Compress Image Free - Reduce Image File Size Online | noupload" },
			{ name: "description", content: "Compress images for free. Reduce JPG, PNG, WebP file size while keeping quality. Adjust compression level. Works offline, completely private." },
			{ name: "keywords", content: "compress image, reduce image size, image compressor, compress jpg, compress png, free image compression" },
			{ property: "og:title", content: "Compress Image Free - Reduce Image File Size Online" },
			{ property: "og:description", content: "Compress images for free. Reduce file size while keeping quality. Works 100% offline." },
		],
	}),
	component: ImageCompressPage,
});

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
import { FormatSelector, InfoBox, QualitySlider } from "@/components/shared";
import { useFileBuffer, useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { downloadMultiple } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { compressImage, copyImageToClipboard, downloadImage, formatFileSize, getOutputFilename } from "@/lib/image-utils";
import type { QualityPreset } from "@/lib/jpeg-quality";
import { formatCompressionResult, formatSizeDelta } from "@/lib/utils";

interface CompressMetadata {
  originalSize: number;
  compressedSize: number;
  keptOriginal: boolean;
  quality: number;
}

type CompressMode = QualityPreset | "custom";

const MODES = [
  { value: "balanced", label: "Balanced", desc: "Much smaller, near identical" },
  { value: "high", label: "High", desc: "No visible difference" },
  { value: "custom", label: "Custom", desc: "Set the quality yourself" },
];

function describeQuality(mode: CompressMode, quality: number): string {
  const q = Math.round(quality * 100);
  return mode === "custom" ? `Quality ${q}` : `${mode === "high" ? "High" : "Balanced"} · quality ${q}`;
}

interface FileItem {
  id: string;
  file: File;
}

interface CompressedItem {
  original: File;
  blob: Blob;
  filename: string;
  keptOriginal: boolean;
  quality: number;
}

function ImageCompressPage() {
  const [mode, setMode] = useState<CompressMode>("balanced");
  const [quality, setQuality] = useState(80);
  const setting = mode === "custom" ? quality / 100 : mode;

  const handleModeChange = useCallback((value: string) => setMode(value as CompressMode), []);

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
    async (fileToProcess: File, q: number | QualityPreset) => {
      if (!startProcessing()) return;
      try {
        setProgress(30);
        const { blob, keptOriginal, quality: used } = await compressImage(fileToProcess, q);
        setProgress(90);
        const filename = keptOriginal
          ? fileToProcess.name
          : getOutputFilename(fileToProcess.name, "jpeg", "_compressed");
        setResult(blob, filename, {
          originalSize: fileToProcess.size,
          compressedSize: blob.size,
          keptOriginal,
          quality: used,
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
    [files.length, clearResult, setPreview, revokePreview],
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
            const { blob, keptOriginal, quality: used } = await compressImage(f, setting);
            const filename = keptOriginal ? f.name : getOutputFilename(f.name, "jpeg", "_compressed");
            return { original: f, blob, filename, keptOriginal, quality: used };
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
  }, [files, setting]);

  const handleDownloadOne = useCallback((item: CompressedItem) => downloadImage(item.blob, item.filename), []);
  const handleDownloadAll = useCallback(() => {
    downloadMultiple(
      bulkResults.map((item) => ({ data: item.blob, filename: item.filename })),
      "compressed_images.zip",
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

  const totalOriginalSize = useMemo(() => files.reduce((sum, f) => sum + f.file.size, 0), [files]);
  const totalCompressedSize = useMemo(() => bulkResults.reduce((sum, r) => sum + r.blob.size, 0), [bulkResults]);
  const keptOriginalCount = useMemo(() => bulkResults.filter((r) => r.keptOriginal).length, [bulkResults]);

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
              <p className="text-sm text-muted-foreground">
                {formatSizeDelta(totalOriginalSize, totalCompressedSize)} overall
                {keptOriginalCount > 0 && ` · ${keptOriginalCount} already optimized`}
              </p>
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
                  <p className="text-xs text-muted-foreground">
                    {formatCompressionResult(item.original.size, item.blob.size, item.keptOriginal)}
                    {!item.keptOriginal && ` · quality ${Math.round(item.quality * 100)}`}
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
            ))}
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
    const { originalSize = 0, compressedSize = 0, keptOriginal = false, quality: used = 0 } = result.metadata ?? {};
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
          title={keptOriginal ? "Already As Small As It Gets" : "Image Compressed!"}
          subtitle={
            keptOriginal
              ? formatCompressionResult(originalSize, compressedSize, keptOriginal)
              : `${formatCompressionResult(originalSize, compressedSize, keptOriginal)} · ${describeQuality(mode, used)}`
          }
          downloadLabel="Download Image"
          onDownload={handleSingleDownload}
          onCopy={result.blob.type === "image/png" ? () => copyImageToClipboard(result.blob) : undefined}
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
          <InfoBox title="About compression">
            Compresses images to JPEG. Balanced and High are tuned to look the same on every browser, since Safari and
            Chrome treat the same quality number very differently. Drop one or multiple files.
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

          <FormatSelector label="Quality" formats={MODES} value={mode} onChange={handleModeChange} />
          {mode === "custom" && <QualitySlider label="Quality" value={quality} onChange={setQuality} />}

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

          <FormatSelector label="Quality" formats={MODES} value={mode} onChange={handleModeChange} />
          {mode === "custom" && <QualitySlider label="Quality" value={quality} onChange={setQuality} />}

          {singleError && <ErrorBox message={singleError} />}
          {isSingleProcessing && <ProgressBar progress={progress} label="Compressing..." />}

          <ProcessButton
            onClick={() => processFile(file!, setting)}
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

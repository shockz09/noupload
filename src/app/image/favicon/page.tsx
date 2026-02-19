"use client";

import { useCallback, useState } from "react";
import { DownloadIcon, FaviconIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import { ErrorBox, ImageFileInfo, ImagePageHeader } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing, useImagePaste, useObjectURL } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { downloadImage, type FaviconSet, formatFileSize, generateFavicons } from "@/lib/image-utils";

interface FaviconResult {
  favicons: FaviconSet;
  hasSvg: boolean;
}

const pngSizes = [
  { key: "ico48", label: "48×48", filename: "favicon.png", use: "Browser fallback" },
  { key: "apple180", label: "180×180", filename: "apple-touch-icon.png", use: "iOS Safari" },
  { key: "android192", label: "192×192", filename: "android-chrome-192x192.png", use: "Android" },
  { key: "android512", label: "512×512", filename: "android-chrome-512x512.png", use: "Android/PWA" },
];

export default function FaviconPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [isSvgUpload, setIsSvgUpload] = useState(false);
  const [result, setResult] = useState<FaviconResult | null>(null);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;

      try {
        const favicons = await generateFavicons(fileToProcess);
        setResult({ favicons, hasSvg: !!favicons.svg });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to generate favicons"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        setResult(null);

        const isSvg = selectedFile.type === "image/svg+xml" || selectedFile.name.endsWith(".svg");
        setIsSvgUpload(isSvg);
        setPreview(selectedFile);

        if (isInstant) {
          processFile(selectedFile);
        }
      }
    },
    [isInstant, processFile, setPreview],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setIsSvgUpload(false);
    setResult(null);
  }, [revokePreview]);

  const handleGenerate = useCallback(() => {
    if (file) processFile(file);
  }, [file, processFile]);

  const handleDownloadSvg = useCallback(() => {
    if (result?.favicons.svg) downloadImage(result.favicons.svg, "favicon.svg");
  }, [result]);

  const handleDownloadPng = useCallback(
    (key: keyof FaviconSet, filename: string) => {
      if (result) {
        const blob = result.favicons[key];
        if (blob) downloadImage(blob, filename);
      }
    },
    [result],
  );

  const handleDownloadAll = useCallback(async () => {
    if (!result) return;

    if (result.favicons.svg) {
      downloadImage(result.favicons.svg, "favicon.svg");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    for (const size of pngSizes) {
      const blob = result.favicons[size.key as keyof FaviconSet];
      if (blob) {
        downloadImage(blob, size.filename);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }, [result]);

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    setIsSvgUpload(false);
    setResult(null);
  }, [revokePreview]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<FaviconIcon className="w-7 h-7" />}
        iconClass="tool-favicon"
        title="Favicon Generator"
        description="Generate modern favicon set from one image"
      />

      {result ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Done</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Favicons Generated!</h2>
              <p className="text-muted-foreground">
                {result.hasSvg ? "SVG + 4 PNG sizes" : "4 PNG sizes"} ready for download
              </p>
            </div>

            <button type="button" onClick={handleDownloadAll} className="btn-success w-full mb-6">
              <DownloadIcon className="w-5 h-5" />
              Download All
            </button>
          </div>

          <div className="space-y-3">
            <span className="input-label">Or download individually</span>
            <div className="grid gap-2">
              {result.hasSvg && (
                <div className="flex items-center justify-between p-3 border-2 border-primary bg-primary/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-primary flex items-center justify-center bg-primary/10">
                      <span className="text-xs font-bold text-primary">SVG</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">favicon.svg</p>
                      <p className="text-xs text-primary font-semibold">Primary - Modern browsers</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Download
                  </button>
                </div>
              )}

              {pngSizes.map((size) => (
                <div
                  key={size.key}
                  className="flex items-center justify-between p-3 border-2 border-foreground bg-background"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-foreground flex items-center justify-center bg-muted/30">
                      <span className="text-xs font-bold">{size.label.split("×")[0]}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">{size.filename}</p>
                      <p className="text-xs text-muted-foreground">{size.use}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadPng(size.key as keyof FaviconSet, size.filename)}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-muted/50 border-2 border-foreground p-4 space-y-3">
            <p className="font-bold text-sm">Add to your HTML:</p>
            <pre className="text-xs font-mono bg-background p-3 border border-foreground overflow-x-auto">
              {result.hasSvg
                ? `<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="48x48">`
                : `<link rel="icon" href="/favicon.png" sizes="48x48">`}
              {`
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`}
            </pre>
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Generate from Another Image
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.svg"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your logo here"
            subtitle="Square images work best · Ctrl+V to paste"
          />

          <InfoBox title={isInstant ? "Instant generation" : "Tip"}>
            {isInstant
              ? "Drop a square image and all favicon sizes will be generated automatically."
              : "Use a square image for best results. We'll generate all sizes for browsers, iOS, and Android."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img
                src={preview}
                alt="Preview"
                className="w-32 h-32 mx-auto object-contain"
                loading="lazy"
                decoding="async"
              />
              {isSvgUpload && (
                <p className="text-center text-xs text-primary font-semibold mt-2">
                  SVG detected - will be used as primary favicon
                </p>
              )}
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          <div className="bg-muted/50 border-2 border-foreground p-4">
            <p className="font-bold text-sm mb-2">Will generate:</p>
            <div className="flex flex-wrap gap-2">
              {isSvgUpload && (
                <span className="px-2 py-1 bg-primary/10 border border-primary text-xs font-bold text-primary">
                  SVG (primary)
                </span>
              )}
              {pngSizes.map((size) => (
                <span key={size.key} className="px-2 py-1 bg-background border border-foreground text-xs font-bold">
                  {size.label} PNG
                </span>
              ))}
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground py-4">
              <LoaderIcon className="w-4 h-4" />
              <span>Generating favicons...</span>
            </div>
          )}

          <button type="button" onClick={handleGenerate} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Generating...
              </>
            ) : (
              <>
                <FaviconIcon className="w-5 h-5" />
                Generate Favicons
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

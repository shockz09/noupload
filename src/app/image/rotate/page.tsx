"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { FlipHorizontalIcon, FlipVerticalIcon } from "@/components/icons/image";
import { RotateIcon } from "@/components/icons/pdf";
import { ErrorBox, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { copyImageToClipboard, flipImage, formatFileSize, getOutputFilename, rotateImage } from "@/lib/image-utils";

type Rotation = 0 | 90 | 180 | 270;

export default function ImageRotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult();

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        setFile(files[0]);
        clearResult();
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setPreview(files[0]);
      }
    },
    [clearResult, setPreview],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    clearResult();
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }, [revokePreview, clearResult]);

  const rotateLeft = useCallback(() => setRotation((prev) => ((prev - 90 + 360) % 360) as Rotation), []);
  const rotateRight = useCallback(() => setRotation((prev) => ((prev + 90) % 360) as Rotation), []);

  const handleApply = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      let blob: Blob = file;
      if (rotation !== 0) blob = await rotateImage(file, rotation);
      if (flipH) blob = await flipImage(new File([blob], file.name, { type: blob.type }), "horizontal");
      if (flipV) blob = await flipImage(new File([blob], file.name, { type: blob.type }), "vertical");
      setResult(blob, getOutputFilename(file.name, undefined, "_transformed"));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to transform image"));
    } finally {
      stopProcessing();
    }
  }, [file, rotation, flipH, flipV, startProcessing, setResult, setError, stopProcessing]);

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
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }, [revokePreview, clearResult]);

  const handleFlipH = useCallback(() => setFlipH((prev) => !prev), []);
  const handleFlipV = useCallback(() => setFlipV((prev) => !prev), []);

  const handleReset = useCallback(() => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }, []);

  const hasChanges = useMemo(() => rotation !== 0 || flipH || flipV, [rotation, flipH, flipV]);
  const previewStyle = useMemo(
    () => ({
      transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    }),
    [rotation, flipH, flipV],
  );

  const changesDescription = useMemo(
    () => [rotation !== 0 && `${rotation}°`, flipH && "H-flip", flipV && "V-flip"].filter(Boolean).join(", "),
    [rotation, flipH, flipV],
  );

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<RotateIcon className="w-7 h-7" />}
        iconClass="tool-rotate-image"
        title="Rotate & Flip"
        description="Rotate 90°, 180°, 270° or flip your images"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Image Transformed!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Transform Another"
        >
          <p className="text-muted-foreground">File size: {formatFileSize(result.blob.size)}</p>
        </SuccessCard>
      ) : !file ? (
        <FileDropzone
          accept=".jpg,.jpeg,.png,.webp"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your image here"
          subtitle="or click to browse · Ctrl+V to paste"
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Live Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Change file
              </button>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={rotateRight}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  rotateRight();
                }
              }}
              className="relative border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px] overflow-hidden cursor-pointer group"
              title="Click to rotate"
            >
              <img
                src={preview!}
                alt="Preview"
                style={previewStyle}
                className="max-h-[180px] object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Click to rotate →
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file.name} • {formatFileSize(file.size)}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Rotate */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Rotate</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={rotateLeft}
                  className="flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Left
                </button>
                <button
                  type="button"
                  onClick={rotateRight}
                  className="flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  Right
                </button>
              </div>
              {rotation !== 0 && <p className="text-xs text-center text-muted-foreground">Rotation: {rotation}°</p>}
            </div>

            {/* Flip */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Flip</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleFlipH}
                  className={`flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                    flipH ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"
                  }`}
                >
                  <FlipHorizontalIcon className="w-4 h-4" />
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={handleFlipV}
                  className={`flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                    flipV ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"
                  }`}
                >
                  <FlipVerticalIcon className="w-4 h-4" />
                  Vertical
                </button>
              </div>
            </div>

            {/* Status */}
            {hasChanges && (
              <div className="flex items-center justify-between p-3 bg-muted/50 border border-foreground/10">
                <p className="text-xs text-muted-foreground">Changes: {changesDescription}</p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              </div>
            )}

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !hasChanges}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateIcon className="w-5 h-5" />
                  Apply Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

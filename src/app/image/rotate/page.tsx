"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { rotateImage, flipImage, downloadImage, formatFileSize, getOutputFilename } from "@/lib/image-utils";
import { RotateIcon, ImageIcon, FlipHorizontalIcon, FlipVerticalIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, ProcessButton, SuccessCard, ImageFileInfo } from "@/components/image/shared";

type Rotation = 0 | 90 | 180 | 270;

export default function ImageRotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
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
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }, [preview]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
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

  const rotateLeft = () => setRotation((prev) => ((prev - 90 + 360) % 360) as Rotation);
  const rotateRight = () => setRotation((prev) => ((prev + 90) % 360) as Rotation);

  const handleApply = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      let blob: Blob = file;
      if (rotation !== 0) blob = await rotateImage(file, rotation);
      if (flipH) {
        const tempFile = new File([blob], file.name, { type: blob.type });
        blob = await flipImage(tempFile, "horizontal");
      }
      if (flipV) {
        const tempFile = new File([blob], file.name, { type: blob.type });
        blob = await flipImage(tempFile, "vertical");
      }
      setResult({ blob, filename: getOutputFilename(file.name, undefined, "_transformed") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transform image");
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
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  const hasChanges = rotation !== 0 || flipH || flipV;
  const previewStyle = { transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
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
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30 overflow-hidden">
              <div className="flex items-center justify-center h-64">
                <img src={preview} alt="Preview" style={previewStyle} className="max-h-full max-w-full object-contain transition-transform duration-300" />
              </div>
            </div>
          )}

          <ImageFileInfo file={file} fileSize={formatFileSize(file.size)} onClear={handleClear} icon={<ImageIcon className="w-5 h-5" />} />

          <div className="space-y-3">
            <label className="input-label">Rotate</label>
            <div className="flex gap-2">
              <button onClick={rotateLeft} className="flex-1 px-4 py-3 border-2 border-foreground font-bold hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                </svg>
                Rotate Left
              </button>
              <button onClick={rotateRight} className="flex-1 px-4 py-3 border-2 border-foreground font-bold hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                </svg>
                Rotate Right
              </button>
            </div>
            {rotation !== 0 && <p className="text-sm text-center text-muted-foreground">Current rotation: {rotation}°</p>}
          </div>

          <div className="space-y-3">
            <label className="input-label">Flip</label>
            <div className="flex gap-2">
              <button onClick={() => setFlipH(!flipH)} className={`flex-1 px-4 py-3 border-2 border-foreground font-bold transition-colors flex items-center justify-center gap-2 ${flipH ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"}`}>
                <FlipHorizontalIcon className="w-5 h-5" />Flip Horizontal
              </button>
              <button onClick={() => setFlipV(!flipV)} className={`flex-1 px-4 py-3 border-2 border-foreground font-bold transition-colors flex items-center justify-center gap-2 ${flipV ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"}`}>
                <FlipVerticalIcon className="w-5 h-5" />Flip Vertical
              </button>
            </div>
          </div>

          {hasChanges && (
            <button onClick={() => { setRotation(0); setFlipH(false); setFlipV(false); }} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Reset all changes
            </button>
          )}

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleApply}
            disabled={!hasChanges}
            isProcessing={isProcessing}
            processingLabel="Processing..."
            icon={<RotateIcon className="w-5 h-5" />}
            label="Apply Changes"
          />
        </div>
      )}
    </div>
  );
}

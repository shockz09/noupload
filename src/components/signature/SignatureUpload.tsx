"use client";

import { memo, useCallback, useState } from "react";
import { TrashIcon, UploadIcon } from "@/components/icons/ui";
import { useBackgroundRemoval } from "@/lib/background-removal/useBackgroundRemoval";

interface SignatureUploadProps {
  onSignatureReady: (dataUrl: string) => void;
  className?: string;
}

export const SignatureUpload = memo(function SignatureUpload({
  onSignatureReady,
  className = "",
}: SignatureUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const { removeBackground, isProcessing, progress } = useBackgroundRemoval();

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setOriginalUrl(dataUrl);
        setProcessedUrl(null);

        if (removeBg) {
          try {
            const result = await removeBackground(file, "medium");
            setProcessedUrl(result.url);
            setPreviewUrl(result.url);
          } catch {
            setPreviewUrl(dataUrl);
          }
        } else {
          setPreviewUrl(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    },
    [removeBg, removeBackground],
  );

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleToggleBgRemoval = useCallback(async () => {
    const newValue = !removeBg;
    setRemoveBg(newValue);

    // If we have an image, switch between original and processed
    if (originalUrl) {
      if (newValue) {
        // Switch to processed version
        if (processedUrl) {
          // Already have processed version, just show it
          setPreviewUrl(processedUrl);
        } else {
          // Need to process for the first time
          try {
            const response = await fetch(originalUrl);
            const blob = await response.blob();
            const result = await removeBackground(blob, "medium");
            setProcessedUrl(result.url);
            setPreviewUrl(result.url);
          } catch {
            // Keep original on error
          }
        }
      } else {
        // Revert to original
        setPreviewUrl(originalUrl);
      }
    }
  }, [removeBg, originalUrl, processedUrl, removeBackground]);

  const handleUseSignature = useCallback(() => {
    if (previewUrl) {
      onSignatureReady(previewUrl);
    }
  }, [previewUrl, onSignatureReady]);

  const handleClear = useCallback(() => {
    setPreviewUrl(null);
    setOriginalUrl(null);
    setProcessedUrl(null);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-sm font-medium text-muted-foreground">Upload signature image</span>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or GIF</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={removeBg}
            onChange={handleToggleBgRemoval}
            disabled={isProcessing}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-xs font-medium">Remove background</span>
        </label>
      </div>

      {isProcessing ? (
        <div className="p-8 border-2 border-foreground/30 flex flex-col items-center justify-center min-h-[120px]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">{progress}</p>
        </div>
      ) : previewUrl ? (
        <div className="space-y-4">
          <div
            className="p-4 border-2 border-foreground flex items-center justify-center min-h-[120px]"
            style={{
              background: "repeating-conic-gradient(#e5e5e5 0% 25%, white 0% 50%) 50% / 16px 16px",
            }}
          >
            <img src={previewUrl} alt="Uploaded signature" className="max-h-24 max-w-full object-contain" />
          </div>
          {processedUrl && removeBg && (
            <p className="text-xs text-green-600 font-medium text-center">Background removed</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleClear} className="btn-secondary flex-1">
              <TrashIcon className="w-4 h-4" />
              Remove
            </button>
            <button type="button" onClick={handleUseSignature} className="btn-primary flex-1">
              Use Signature
            </button>
          </div>
        </div>
      ) : (
        <label
          className="block cursor-pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div
            className={`border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-foreground/30 hover:border-primary hover:bg-accent/50"
            }`}
          >
            <UploadIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">{isDragging ? "Drop image here" : "Click or drag to upload"}</p>
            <p className="text-sm text-muted-foreground">PNG, JPG, or GIF</p>
          </div>
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </label>
      )}
    </div>
  );
});

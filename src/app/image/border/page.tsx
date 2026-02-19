"use client";

import { useCallback, useMemo, useState } from "react";
import { BorderIcon, LoaderIcon } from "@/components/icons";
import { ErrorBox, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { addBorder, copyImageToClipboard, formatFileSize, getOutputFilename } from "@/lib/image-utils";

const presetColors = ["#000000", "#FFFFFF", "#ef4444", "#3b82f6", "#22c55e", "#eab308"];

const widthPresets = [
  { value: 10, label: "S" },
  { value: 30, label: "M" },
  { value: 60, label: "L" },
  { value: 100, label: "XL" },
];

export default function ImageBorderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [borderWidth, setBorderWidth] = useState(30);
  const [borderColor, setBorderColor] = useState("#000000");

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult();

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        setFile(files[0]);
        clearResult();
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
  }, [revokePreview, clearResult]);

  const handleApply = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const bordered = await addBorder(file, borderWidth, borderColor);
      setResult(bordered, getOutputFilename(file.name, undefined, "_bordered"));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add border"));
    } finally {
      stopProcessing();
    }
  }, [file, borderWidth, borderColor, startProcessing, setResult, setError, stopProcessing]);

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
  }, [revokePreview, clearResult]);

  const handleWidthPreset = useCallback((width: number) => {
    setBorderWidth(width);
  }, []);

  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBorderWidth(Number(e.target.value));
  }, []);

  const handleColorPreset = useCallback((color: string) => {
    setBorderColor(color);
  }, []);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBorderColor(e.target.value);
  }, []);

  const previewPadding = useMemo(() => Math.min(borderWidth * 0.15, 20), [borderWidth]);

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<BorderIcon className="w-7 h-7" />}
        iconClass="tool-border"
        title="Add Border"
        description="Add a colored border around images"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Border Added!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Add Border to Another"
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
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px]">
              <div
                style={{
                  padding: `${previewPadding}px`,
                  backgroundColor: borderColor,
                }}
                className="inline-block transition-all duration-150"
              >
                <img
                  src={preview!}
                  alt="Preview"
                  className="max-h-[160px] object-contain block"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file.name} • {formatFileSize(file.size)}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Width Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Width</span>
                <span className="text-xs font-bold">{borderWidth}px</span>
              </div>
              <div className="flex gap-1">
                {widthPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.value}
                    onClick={() => handleWidthPreset(preset.value)}
                    className={`flex-1 py-1.5 text-xs font-bold border-2 transition-all ${
                      borderWidth === preset.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="1"
                max="200"
                value={borderWidth}
                onChange={handleWidthChange}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Color</span>
              <div className="flex gap-1">
                {presetColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => handleColorPreset(color)}
                    className={`w-7 h-8 border-2 transition-all ${
                      borderColor === color
                        ? "border-foreground ring-2 ring-offset-1 ring-foreground"
                        : "border-foreground/20 hover:border-foreground/50"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={borderColor}
                  onChange={handleColorChange}
                  className="w-7 h-8 border-2 border-foreground/20 cursor-pointer"
                />
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
            <button type="button" onClick={handleApply} disabled={isProcessing} className="btn-primary w-full">
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <BorderIcon className="w-5 h-5" />
                  Add {borderWidth}px Border
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

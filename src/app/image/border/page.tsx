"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { addBorder, downloadImage, copyImageToClipboard, formatFileSize, getOutputFilename } from "@/lib/image-utils";
import { BorderIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, SuccessCard } from "@/components/image/shared";

// 6 colors to fit in one row
const presetColors = ["#000000", "#FFFFFF", "#ef4444", "#3b82f6", "#22c55e", "#eab308"];

// Width presets
const widthPresets = [
  { value: 10, label: "S" },
  { value: 30, label: "M" },
  { value: 60, label: "L" },
  { value: 100, label: "XL" },
];

export default function ImageBorderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [borderWidth, setBorderWidth] = useState(30);
  const [borderColor, setBorderColor] = useState("#000000");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
      setPreview(URL.createObjectURL(files[0]));
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
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) handleFileSelected([f]);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileSelected]);

  const handleApply = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const bordered = await addBorder(file, borderWidth, borderColor);
      setResult({ blob: bordered, filename: getOutputFilename(file.name, undefined, "_bordered") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add border");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    if (result) downloadImage(result.blob, result.filename);
  };

  const handleStartOver = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

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
              <button onClick={handleClear} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px]">
              <div
                style={{ padding: `${Math.min(borderWidth * 0.15, 20)}px`, backgroundColor: borderColor }}
                className="inline-block transition-all duration-150"
              >
                <img src={preview!} alt="Preview" className="max-h-[160px] object-contain block" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">{file.name} • {formatFileSize(file.size)}</p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Width Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Width</label>
                <span className="text-xs font-bold">{borderWidth}px</span>
              </div>
              <div className="flex gap-1">
                {widthPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setBorderWidth(preset.value)}
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
                onChange={(e) => setBorderWidth(Number(e.target.value))}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Color</label>
              <div className="flex gap-1">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBorderColor(color)}
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
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="w-7 h-8 border-2 border-foreground/20 cursor-pointer"
                />
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
            <button onClick={handleApply} disabled={isProcessing} className="btn-primary w-full">
              {isProcessing ? (
                <><LoaderIcon className="w-5 h-5" />Processing...</>
              ) : (
                <><BorderIcon className="w-5 h-5" />Add {borderWidth}px Border</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderIcon, WatermarkIcon } from "@/components/icons";
import { ErrorBox, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { addWatermark, copyImageToClipboard, formatFileSize, getOutputFilename } from "@/lib/image-utils";

type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const sizePresets = [
  { value: 24, label: "S" },
  { value: 48, label: "M" },
  { value: 72, label: "L" },
  { value: 120, label: "XL" },
];

const opacityPresets = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

const colorPresets = ["#000000", "#FFFFFF", "#ef4444", "#3b82f6", "#22c55e", "#eab308"];

export default function ImageWatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("© Your Name");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(50);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [color, setColor] = useState("#000000");

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
    if (!file || !text.trim()) return;
    if (!startProcessing()) return;

    try {
      const watermarked = await addWatermark(file, {
        text: text.trim(),
        fontSize,
        opacity: opacity / 100,
        position,
        rotation: 0,
        color,
      });
      setResult(watermarked, getOutputFilename(file.name, undefined, "_watermarked"));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add watermark"));
    } finally {
      stopProcessing();
    }
  }, [file, text, fontSize, opacity, position, color, startProcessing, setResult, setError, stopProcessing]);

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

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  }, []);

  const handleSizeSelect = useCallback((size: number) => setFontSize(size), []);
  const handleOpacitySelect = useCallback((op: number) => setOpacity(op), []);
  const handleColorSelect = useCallback((c: string) => setColor(c), []);
  const handlePositionSelect = useCallback((pos: Position) => setPosition(pos), []);

  const watermarkStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      fontSize: `${Math.max(8, fontSize * 0.15)}px`,
      color,
      opacity: opacity / 100,
      fontWeight: "bold",
      whiteSpace: "nowrap",
      textShadow:
        color === "#FFFFFF" || color === "#f5f5f5" ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(255,255,255,0.3)",
    };
    switch (position) {
      case "top-left":
        return { ...base, top: "8px", left: "8px" };
      case "top-right":
        return { ...base, top: "8px", right: "8px" };
      case "center":
        return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
      case "bottom-left":
        return { ...base, bottom: "8px", left: "8px" };
      case "bottom-right":
        return { ...base, bottom: "8px", right: "8px" };
    }
  }, [fontSize, color, opacity, position]);

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<WatermarkIcon className="w-7 h-7" />}
        iconClass="tool-image-watermark"
        title="Add Watermark"
        description="Add text watermarks to your images"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Watermark Added!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Watermark Another"
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
          {/* Left: Preview */}
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
              <div className="relative inline-block overflow-hidden">
                <img
                  src={preview!}
                  alt="Preview"
                  className="max-h-[180px] object-contain"
                  loading="lazy"
                  decoding="async"
                />
                {text && <div style={watermarkStyle}>{text}</div>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file.name} • {formatFileSize(file.size)}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Text Input */}
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Text</span>
              <input
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder="Watermark text"
                className="w-full px-3 py-2 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
              />
            </div>

            {/* Position + Size Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Position - Visual Grid */}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Position</span>
                <div className="grid grid-cols-3 gap-1 w-fit">
                  {(
                    [{ pos: "top-left" }, { spacer: "s1" }, { pos: "top-right" }, { spacer: "s2" }, { pos: "center" }, { spacer: "s3" }, { pos: "bottom-left" }, { spacer: "s4" }, { pos: "bottom-right" }] as const
                  ).map((item) =>
                    "pos" in item ? (
                      <button
                        type="button"
                        key={item.pos}
                        onClick={() => handlePositionSelect(item.pos)}
                        className={`w-7 h-7 border-2 transition-all flex items-center justify-center ${
                          position === item.pos
                            ? "border-foreground bg-foreground"
                            : "border-foreground/30 hover:border-foreground bg-muted/50"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${position === item.pos ? "bg-background" : "bg-foreground/40"}`}
                        />
                      </button>
                    ) : (
                      <div key={item.spacer} className="w-7 h-7" />
                    ),
                  )}
                </div>
              </div>

              {/* Size Presets */}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Size</span>
                <div className="flex gap-1">
                  {sizePresets.map((size) => (
                    <button
                      type="button"
                      key={size.value}
                      onClick={() => handleSizeSelect(size.value)}
                      className={`flex-1 py-1.5 text-xs font-bold border-2 transition-all ${
                        fontSize === size.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/30 hover:border-foreground"
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Opacity + Color Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Opacity Presets */}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Opacity</span>
                <div className="flex gap-1">
                  {opacityPresets.map((op) => (
                    <button
                      type="button"
                      key={op.value}
                      onClick={() => handleOpacitySelect(op.value)}
                      className={`flex-1 py-1.5 text-xs font-bold border-2 transition-all ${
                        opacity === op.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/30 hover:border-foreground"
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Chips */}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Color</span>
                <div className="flex gap-1">
                  {colorPresets.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => handleColorSelect(c)}
                      className={`w-7 h-8 border-2 transition-all ${
                        color === c
                          ? "border-foreground ring-2 ring-offset-1 ring-foreground"
                          : "border-foreground/20 hover:border-foreground/50"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !text.trim()}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <WatermarkIcon className="w-5 h-5" />
                  Add Watermark
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

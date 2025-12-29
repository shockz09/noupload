"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { addWatermark, downloadImage, formatFileSize, getOutputFilename } from "@/lib/image-utils";
import { WatermarkIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, SuccessCard } from "@/components/image/shared";

type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface WatermarkResult {
  blob: Blob;
  filename: string;
}

// Size presets instead of slider
const sizePresets = [
  { value: 24, label: "S" },
  { value: 48, label: "M" },
  { value: 72, label: "L" },
  { value: 120, label: "XL" },
];

// Opacity presets
const opacityPresets = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

// Color presets (6 to fit in one row)
const colorPresets = [
  "#000000", "#FFFFFF", "#ef4444", "#3b82f6", "#22c55e", "#eab308",
];

export default function ImageWatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("© Your Name");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(50);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [color, setColor] = useState("#000000");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WatermarkResult | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);
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
  }, [preview]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const pastedFile = item.getAsFile();
          if (pastedFile) handleFileSelected([pastedFile]);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileSelected]);

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const watermarked = await addWatermark(file, {
        text: text.trim(),
        fontSize,
        opacity: opacity / 100,
        position,
        rotation: 0,
        color,
      });
      setResult({
        blob: watermarked,
        filename: getOutputFilename(file.name, undefined, "_watermarked"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add watermark");
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
  };

  // Get preview watermark position styles
  const getWatermarkStyle = () => {
    const base: React.CSSProperties = {
      position: "absolute",
      fontSize: `${Math.max(8, fontSize * 0.15)}px`,
      color,
      opacity: opacity / 100,
      fontWeight: "bold",
      whiteSpace: "nowrap",
      textShadow: color === "#FFFFFF" || color === "#f5f5f5"
        ? "0 1px 2px rgba(0,0,0,0.3)"
        : "0 1px 2px rgba(255,255,255,0.3)",
    };
    switch (position) {
      case "top-left": return { ...base, top: "8px", left: "8px" };
      case "top-right": return { ...base, top: "8px", right: "8px" };
      case "center": return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
      case "bottom-left": return { ...base, bottom: "8px", left: "8px" };
      case "bottom-right": return { ...base, bottom: "8px", right: "8px" };
    }
  };

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
              <button onClick={handleClear} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px]">
              <div className="relative inline-block overflow-hidden">
                <img src={preview!} alt="Preview" className="max-h-[180px] object-contain" />
                {text && <div style={getWatermarkStyle()}>{text}</div>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">{file.name} • {formatFileSize(file.size)}</p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Text Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Text</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Watermark text"
                autoFocus
                className="w-full px-3 py-2 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
              />
            </div>

            {/* Position + Size Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Position - Visual Grid */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Position</label>
                <div className="grid grid-cols-3 gap-1 w-fit">
                  {(["top-left", null, "top-right", null, "center", null, "bottom-left", null, "bottom-right"] as const).map((pos, i) => (
                    pos ? (
                      <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        className={`w-7 h-7 border-2 transition-all flex items-center justify-center ${
                          position === pos
                            ? "border-foreground bg-foreground"
                            : "border-foreground/30 hover:border-foreground bg-muted/50"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${position === pos ? "bg-background" : "bg-foreground/40"}`} />
                      </button>
                    ) : (
                      <div key={i} className="w-7 h-7" />
                    )
                  ))}
                </div>
              </div>

              {/* Size Presets */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Size</label>
                <div className="flex gap-1">
                  {sizePresets.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setFontSize(size.value)}
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
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Opacity</label>
                <div className="flex gap-1">
                  {opacityPresets.map((op) => (
                    <button
                      key={op.value}
                      onClick={() => setOpacity(op.value)}
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
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Color</label>
                <div className="flex gap-1">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
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
              onClick={handleApply}
              disabled={isProcessing || !text.trim()}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <><LoaderIcon className="w-5 h-5" />Processing...</>
              ) : (
                <><WatermarkIcon className="w-5 h-5" />Add Watermark</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

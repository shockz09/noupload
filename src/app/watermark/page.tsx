"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages, PageGridLoading } from "@/components/pdf/pdf-page-preview";
import { addWatermark, downloadBlob } from "@/lib/pdf-utils";
import { WatermarkIcon, LoaderIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard } from "@/components/pdf/shared";

interface WatermarkResult {
  data: Uint8Array;
  filename: string;
}

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WatermarkResult | null>(null);

  // Watermark settings
  const [watermarkText, setWatermarkText] = useState("");
  const [fontSize, setFontSize] = useState(50);
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(-45);

  // Position as percentage (0-100)
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  const { pages, loading, progress } = usePdfPages(file, 0.8);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
  }, []);

  // Calculate position from mouse/touch event
  const getPositionFromEvent = (clientX: number, clientY: number) => {
    if (!previewRef.current) return null;
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = 100 - ((clientY - rect.top) / rect.height) * 100; // Invert Y for PDF coords
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const pos = getPositionFromEvent(e.clientX, e.clientY);
    if (pos) setPosition(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const pos = getPositionFromEvent(e.clientX, e.clientY);
    if (pos) setPosition(pos);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    const pos = getPositionFromEvent(touch.clientX, touch.clientY);
    if (pos) setPosition(pos);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const pos = getPositionFromEvent(touch.clientX, touch.clientY);
    if (pos) setPosition(pos);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Handle mouse leave
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const handleAddWatermark = async () => {
    if (!file || !watermarkText.trim()) {
      setError("Please enter watermark text");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const data = await addWatermark(file, watermarkText, {
        fontSize,
        opacity: opacity / 100,
        rotation,
        x: position.x,
        y: position.y,
      });

      const baseName = file.name.replace(".pdf", "");
      setResult({
        data,
        filename: `${baseName}_watermarked.pdf`,
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
    if (result) {
      downloadBlob(result.data, result.filename);
    }
  };

  const handleStartOver = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setWatermarkText("");
    setPosition({ x: 50, y: 50 });
  };

  // Get the first page for preview
  const previewPage = pages[0];

  return (
    <div className="page-enter max-w-6xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<WatermarkIcon className="w-7 h-7" />}
        iconClass="tool-watermark"
        title="Add Watermark"
        description="Drag to position your watermark anywhere"
      />

      {result ? (
        <div className="max-w-2xl mx-auto">
          <SuccessCard
            stampText="Complete"
            title="Watermark Added!"
            downloadLabel="Download PDF"
            onDownload={handleDownload}
            onStartOver={handleStartOver}
            startOverLabel="Add Another Watermark"
          >
            <p className="text-muted-foreground">Your watermarked PDF is ready</p>
          </SuccessCard>
        </div>
      ) : !file ? (
        <div className="max-w-2xl mx-auto">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Preview with draggable watermark */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Click or drag to position</h3>
              <button
                onClick={handleClear}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Change file
              </button>
            </div>

            {loading ? (
              <PageGridLoading progress={progress} />
            ) : previewPage ? (
              <div
                ref={previewRef}
                className={`relative border-2 border-foreground bg-white cursor-crosshair select-none overflow-hidden ${
                  isDragging ? "cursor-grabbing" : ""
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* PDF Page */}
                <img
                  src={previewPage.dataUrl}
                  alt="PDF Preview"
                  className="w-full h-auto block pointer-events-none"
                  draggable={false}
                />

                {/* Watermark Overlay */}
                {watermarkText && (
                  <div
                    className="absolute pointer-events-none transition-all duration-75"
                    style={{
                      left: `${position.x}%`,
                      bottom: `${position.y}%`,
                      transform: `translate(-50%, 50%) rotate(${rotation}deg)`,
                      fontSize: `${Math.max(8, fontSize * 0.3)}px`,
                      opacity: opacity / 100,
                      color: "#333",
                      fontWeight: "bold",
                      textShadow: "0 1px 2px rgba(255,255,255,0.5)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {watermarkText}
                  </div>
                )}

                {/* Position Indicator */}
                <div
                  className="absolute w-4 h-4 border-2 border-primary bg-primary/20 rounded-full pointer-events-none transition-all duration-75"
                  style={{
                    left: `${position.x}%`,
                    bottom: `${position.y}%`,
                    transform: "translate(-50%, 50%)",
                  }}
                />

                {/* Instruction overlay when no text */}
                {!watermarkText && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
                    <p className="text-muted-foreground font-medium px-4 py-2 bg-white/90 border-2 border-foreground">
                      Enter watermark text first →
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Position readout */}
            <div className="flex items-center justify-center gap-4 text-sm font-mono text-muted-foreground">
              <span>X: {position.x.toFixed(0)}%</span>
              <span>Y: {position.y.toFixed(0)}%</span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="space-y-6">
            {/* Watermark Text */}
            <div className="p-6 bg-card border-2 border-foreground space-y-6">
              <div className="space-y-2">
                <label className="input-label">Watermark Text</label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Enter your watermark text"
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="input-label">Font Size: {fontSize}px</label>
                  <input
                    type="range"
                    min={20}
                    max={150}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="input-label">Opacity: {opacity}%</label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="input-label">Rotation: {rotation}°</label>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Quick presets */}
              <div className="space-y-2">
                <label className="input-label">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setPosition({ x: 50, y: 50 }); setRotation(-45); }}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Center Diagonal
                  </button>
                  <button
                    onClick={() => { setPosition({ x: 50, y: 50 }); setRotation(0); }}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Center Straight
                  </button>
                  <button
                    onClick={() => { setPosition({ x: 50, y: 10 }); setRotation(0); }}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Center
                  </button>
                  <button
                    onClick={() => { setPosition({ x: 90, y: 90 }); setRotation(0); }}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Top Right
                  </button>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="info-box">
              <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="text-sm">
                Watermark will be applied to all {pages.length} pages at the same position.
              </span>
            </div>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding watermark..." />}

            {/* Action Button */}
            <button
              onClick={handleAddWatermark}
              disabled={isProcessing || !watermarkText.trim()}
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
                  Add Watermark to {pages.length} Pages
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages, PageGridLoading } from "@/components/pdf/pdf-page-preview";
import { addPageNumbers, downloadBlob } from "@/lib/pdf-utils";
import { NumbersIcon, LoaderIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard } from "@/components/pdf/shared";

interface PageNumbersResult {
  data: Uint8Array;
  filename: string;
}

export default function PageNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PageNumbersResult | null>(null);

  // Settings
  const [fontSize, setFontSize] = useState(12);
  const [startFrom, setStartFrom] = useState(1);
  const [format, setFormat] = useState("{n}");

  // Position as percentage (0-100)
  const [position, setPosition] = useState({ x: 50, y: 5 });
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

  // Touch events
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

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const handleAddPageNumbers = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const data = await addPageNumbers(file, {
        fontSize,
        startFrom,
        format,
        x: position.x,
        y: position.y,
      });

      const baseName = file.name.replace(".pdf", "");
      setResult({
        data,
        filename: `${baseName}_numbered.pdf`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add page numbers");
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
    setPosition({ x: 50, y: 5 });
  };

  // Format the page number for preview
  const formatPageNumber = (pageNum: number, total: number) => {
    return format
      .replace("{n}", String(pageNum + startFrom - 1))
      .replace("{total}", String(total));
  };

  const presetFormats = [
    { value: "{n}", label: "1, 2, 3" },
    { value: "Page {n}", label: "Page 1" },
    { value: "{n} / {total}", label: "1 / 10" },
    { value: "- {n} -", label: "- 1 -" },
  ];

  const previewPage = pages[0];

  return (
    <div className="page-enter max-w-6xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<NumbersIcon className="w-7 h-7" />}
        iconClass="tool-page-numbers"
        title="Add Page Numbers"
        description="Drag to position page numbers anywhere"
      />

      {result ? (
        <div className="max-w-2xl mx-auto">
          <SuccessCard
            stampText="Complete"
            title="Page Numbers Added!"
            downloadLabel="Download PDF"
            onDownload={handleDownload}
            onStartOver={handleStartOver}
            startOverLabel="Number Another PDF"
          >
            <p className="text-muted-foreground">All {pages.length} pages now have numbers</p>
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
          {/* Left: Preview with draggable position */}
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

                {/* Page Number Overlay */}
                <div
                  className="absolute pointer-events-none transition-all duration-75"
                  style={{
                    left: `${position.x}%`,
                    bottom: `${position.y}%`,
                    transform: "translate(-50%, 50%)",
                  }}
                >
                  <span
                    className="px-2 py-0.5 bg-white/90 border border-foreground/20 font-mono"
                    style={{ fontSize: `${Math.max(8, fontSize * 0.8)}px` }}
                  >
                    {formatPageNumber(1, pages.length)}
                  </span>
                </div>

                {/* Position Indicator */}
                <div
                  className="absolute w-4 h-4 border-2 border-primary bg-primary/20 rounded-full pointer-events-none transition-all duration-75"
                  style={{
                    left: `${position.x}%`,
                    bottom: `${position.y}%`,
                    transform: "translate(-50%, 50%)",
                  }}
                />
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
            <div className="p-6 bg-card border-2 border-foreground space-y-6">
              {/* Format */}
              <div className="space-y-3">
                <label className="input-label">Number Format</label>
                <div className="flex flex-wrap gap-2">
                  {presetFormats.map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setFormat(fmt.value)}
                      className={`px-4 py-2 border-2 font-bold text-sm transition-all
                        ${format === fmt.value
                          ? "bg-primary border-foreground text-white"
                          : "bg-muted border-foreground hover:bg-accent"
                        }
                      `}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="Custom: {n} = page, {total} = total"
                  className="input-field"
                />
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="input-label">Font Size: {fontSize}pt</label>
                  <input
                    type="range"
                    min={8}
                    max={36}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="input-label">Start From</label>
                  <input
                    type="number"
                    min={0}
                    value={startFrom}
                    onChange={(e) => setStartFrom(Number(e.target.value))}
                    className="input-field text-center"
                  />
                </div>
              </div>

              {/* Quick position presets */}
              <div className="space-y-2">
                <label className="input-label">Quick Positions</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPosition({ x: 50, y: 5 })}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Center
                  </button>
                  <button
                    onClick={() => setPosition({ x: 50, y: 95 })}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Top Center
                  </button>
                  <button
                    onClick={() => setPosition({ x: 90, y: 5 })}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Right
                  </button>
                  <button
                    onClick={() => setPosition({ x: 10, y: 5 })}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Left
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
                Numbers will be added to all {pages.length} pages at the same position.
              </span>
            </div>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding page numbers..." />}

            {/* Action Button */}
            <button
              onClick={handleAddPageNumbers}
              disabled={isProcessing}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <NumbersIcon className="w-5 h-5" />
                  Add Numbers to {pages.length} Pages
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

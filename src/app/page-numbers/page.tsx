"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { NumbersIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PageGridLoading, usePdfPages } from "@/components/pdf/pdf-page-preview";
import { ErrorBox, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { addPageNumbers } from "@/lib/pdf-utils";
import { getFileBaseName } from "@/lib/utils";

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
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

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
  const getPositionFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!previewRef.current) return null;
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = 100 - ((clientY - rect.top) / rect.height) * 100; // Invert Y for PDF coords
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const pos = getPositionFromEvent(e.clientX, e.clientY);
      if (pos) setPosition(pos);
    },
    [getPositionFromEvent],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      const pos = getPositionFromEvent(e.clientX, e.clientY);
      if (pos) setPosition(pos);
    },
    [getPositionFromEvent],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      const touch = e.touches[0];
      const pos = getPositionFromEvent(touch.clientX, touch.clientY);
      if (pos) setPosition(pos);
    },
    [getPositionFromEvent],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      const pos = getPositionFromEvent(touch.clientX, touch.clientY);
      if (pos) setPosition(pos);
    },
    [getPositionFromEvent],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const handleAddPageNumbers = useCallback(async () => {
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

      const baseName = getFileBaseName(file.name);
      setResult({
        data,
        filename: `${baseName}_numbered.pdf`,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add page numbers"));
    } finally {
      setIsProcessing(false);
    }
  }, [file, fontSize, startFrom, format, position.x, position.y]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) {
        downloadBlob(result.data, result.filename);
      }
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setPosition({ x: 50, y: 5 });
  }, []);

  // Input handlers
  const handleFormatChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormat(e.target.value);
  }, []);

  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFontSize(Number(e.target.value));
  }, []);

  const handleStartFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStartFrom(Number(e.target.value));
  }, []);

  // Format preset handler
  const handleFormatSelect = useCallback((value: string) => {
    setFormat(value);
  }, []);

  // Position preset handlers
  const setPositionBottomCenter = useCallback(() => setPosition({ x: 50, y: 5 }), []);
  const setPositionTopCenter = useCallback(() => setPosition({ x: 50, y: 95 }), []);
  const setPositionBottomRight = useCallback(() => setPosition({ x: 90, y: 5 }), []);
  const setPositionBottomLeft = useCallback(() => setPosition({ x: 10, y: 5 }), []);

  // Format the page number for preview
  const formatPageNumber = useCallback(
    (pageNum: number, total: number) => {
      return format.replace("{n}", String(pageNum + startFrom - 1)).replace("{total}", String(total));
    },
    [format, startFrom],
  );

  // Memoized values
  const presetFormats = useMemo(
    () => [
      { value: "{n}", label: "1, 2, 3" },
      { value: "Page {n}", label: "Page 1" },
      { value: "{n} / {total}", label: "1 / 10" },
      { value: "- {n} -", label: "- 1 -" },
    ],
    [],
  );

  const previewPage = useMemo(() => pages[0], [pages]);

  const positionStyle = useMemo(
    () => ({
      left: `${position.x}%`,
      bottom: `${position.y}%`,
      transform: "translate(-50%, 50%)",
    }),
    [position.x, position.y],
  );

  const fontSizeStyle = useMemo(
    () => ({
      fontSize: `${Math.max(8, fontSize * 0.8)}px`,
    }),
    [fontSize],
  );

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
                type="button"
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
                role="application"
                aria-label="Page number position editor"
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
                  loading="lazy"
                  decoding="async"
                />

                {/* Page Number Overlay */}
                <div className="absolute pointer-events-none transition-all duration-75" style={positionStyle}>
                  <span className="px-2 py-0.5 bg-white/90 border border-foreground/20 font-mono" style={fontSizeStyle}>
                    {formatPageNumber(1, pages.length)}
                  </span>
                </div>

                {/* Position Indicator */}
                <div
                  className="absolute w-4 h-4 border-2 border-primary bg-primary/20 rounded-full pointer-events-none transition-all duration-75"
                  style={positionStyle}
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
                <span className="input-label">Number Format</span>
                <div className="flex flex-wrap gap-2">
                  {presetFormats.map((fmt) => (
                    <button
                      type="button"
                      key={fmt.value}
                      onClick={() => handleFormatSelect(fmt.value)}
                      className={`px-4 py-2 border-2 font-bold text-sm transition-all
                        ${
                          format === fmt.value
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
                  onChange={handleFormatChange}
                  placeholder="Custom: {n} = page, {total} = total"
                  className="input-field"
                />
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="input-label">Font Size: {fontSize}pt</span>
                  <input
                    type="range"
                    min={8}
                    max={36}
                    value={fontSize}
                    onChange={handleFontSizeChange}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <span className="input-label">Start From</span>
                  <input
                    type="number"
                    min={0}
                    value={startFrom}
                    onChange={handleStartFromChange}
                    className="input-field text-center"
                  />
                </div>
              </div>

              {/* Quick position presets */}
              <div className="space-y-2">
                <span className="input-label">Quick Positions</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={setPositionBottomCenter}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Center
                  </button>
                  <button
                    type="button"
                    onClick={setPositionTopCenter}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Top Center
                  </button>
                  <button
                    type="button"
                    onClick={setPositionBottomRight}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Right
                  </button>
                  <button
                    type="button"
                    onClick={setPositionBottomLeft}
                    className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                  >
                    Bottom Left
                  </button>
                </div>
              </div>
            </div>

            {/* Info */}
            <InfoBox>Numbers will be added to all {pages.length} pages at the same position.</InfoBox>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding page numbers..." />}

            {/* Action Button */}
            <button type="button" onClick={handleAddPageNumbers} disabled={isProcessing} className="btn-primary w-full">
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

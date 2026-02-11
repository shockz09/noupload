"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderIcon, SignatureIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PageGridLoading, usePdfPages } from "@/components/pdf/pdf-page-preview";
import { ErrorBox, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { SignatureDrawPad, SignatureUpload } from "@/components/signature";
import { addSignature, downloadBlob } from "@/lib/pdf-utils";
import { getFileBaseName } from "@/lib/utils";

interface SignResult {
  data: Uint8Array;
  filename: string;
}

type SignatureMode = "draw" | "upload";

export default function SignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);

  // Signature
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureWidth, setSignatureWidth] = useState(150);

  // Position as percentage (0-100)
  const [position, setPosition] = useState({ x: 70, y: 10 });
  const [isDragging, setIsDragging] = useState(false);

  // Preview
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

  // Handle signature ready from shared components
  const handleSignatureReady = useCallback((dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
  }, []);

  // Position from event - use ref to avoid stale closures in drag handlers
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;

  const getPositionFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!previewRef.current) return null;
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = 100 - ((clientY - rect.top) / rect.height) * 100;
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

  const handleSign = useCallback(async () => {
    if (!file || !signatureDataUrl) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const data = await addSignature(file, signatureDataUrl, {
        x: position.x,
        y: position.y,
        width: signatureWidth,
      });

      const baseName = getFileBaseName(file.name);
      setResult({
        data,
        filename: `${baseName}_signed.pdf`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign PDF");
    } finally {
      setIsProcessing(false);
    }
  }, [file, signatureDataUrl, position.x, position.y, signatureWidth]);

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
    setSignatureDataUrl(null);
    setPosition({ x: 70, y: 10 });
  }, []);

  // Mode toggle callbacks
  const setModeDraw = useCallback(() => setSignatureMode("draw"), []);
  const setModeUpload = useCallback(() => setSignatureMode("upload"), []);

  // Quick position callbacks
  const setPositionBottomRight = useCallback(() => setPosition({ x: 70, y: 10 }), []);
  const setPositionBottomLeft = useCallback(() => setPosition({ x: 30, y: 10 }), []);
  const setPositionCenter = useCallback(() => setPosition({ x: 50, y: 50 }), []);

  // Signature width handler
  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSignatureWidth(Number(e.target.value));
  }, []);

  const previewPage = useMemo(() => pages[0], [pages]);

  return (
    <div className="page-enter max-w-6xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<SignatureIcon className="w-7 h-7" />}
        iconClass="tool-sign"
        title="Sign PDF"
        description="Draw or upload your signature, then place it anywhere"
      />

      {result ? (
        <div className="max-w-2xl mx-auto">
          <SuccessCard
            stampText="Signed"
            title="PDF Signed!"
            downloadLabel="Download Signed PDF"
            onDownload={handleDownload}
            onStartOver={handleStartOver}
            startOverLabel="Sign Another PDF"
          >
            <p className="text-muted-foreground">Your signature has been added to the PDF</p>
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
          {/* Left: PDF Preview with signature placement */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {signatureDataUrl ? "Click or drag to position" : "Add signature first →"}
              </h3>
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
                className={`relative border-2 border-foreground bg-white select-none overflow-hidden ${
                  signatureDataUrl ? "cursor-crosshair" : "cursor-not-allowed opacity-75"
                } ${isDragging ? "cursor-grabbing" : ""}`}
                onMouseDown={signatureDataUrl ? handleMouseDown : undefined}
                onMouseMove={signatureDataUrl ? handleMouseMove : undefined}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={signatureDataUrl ? handleTouchStart : undefined}
                onTouchMove={signatureDataUrl ? handleTouchMove : undefined}
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

                {/* Signature Overlay */}
                {signatureDataUrl && (
                  <div
                    className="absolute pointer-events-none transition-all duration-75"
                    style={{
                      left: `${position.x}%`,
                      bottom: `${position.y}%`,
                      transform: "translate(-50%, 50%)",
                      maxWidth: `${signatureWidth * 0.3}px`,
                    }}
                  >
                    <img
                      src={signatureDataUrl}
                      alt="Signature"
                      className="w-full h-auto"
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}

                {/* Position Indicator */}
                {signatureDataUrl && (
                  <div
                    className="absolute w-4 h-4 border-2 border-primary bg-primary/20 rounded-full pointer-events-none transition-all duration-75"
                    style={{
                      left: `${position.x}%`,
                      bottom: `${position.y}%`,
                      transform: "translate(-50%, 50%)",
                    }}
                  />
                )}

                {/* Overlay when no signature */}
                {!signatureDataUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
                    <p className="text-muted-foreground font-medium px-4 py-2 bg-white/90 border-2 border-foreground">
                      Create your signature first →
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Position readout */}
            {signatureDataUrl && (
              <div className="flex items-center justify-center gap-4 text-sm font-mono text-muted-foreground">
                <span>X: {position.x.toFixed(0)}%</span>
                <span>Y: {position.y.toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Right: Signature creation */}
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex border-2 border-foreground">
              <button
                type="button"
                onClick={setModeDraw}
                className={`flex-1 py-3 px-4 font-bold transition-colors ${
                  signatureMode === "draw" ? "bg-primary text-white" : "bg-card hover:bg-accent"
                }`}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={setModeUpload}
                className={`flex-1 py-3 px-4 font-bold border-l-2 border-foreground transition-colors ${
                  signatureMode === "upload" ? "bg-primary text-white" : "bg-card hover:bg-accent"
                }`}
              >
                Upload Image
              </button>
            </div>

            {/* Signature Area */}
            <div className="p-6 bg-card border-2 border-foreground">
              {signatureMode === "draw" ? (
                <SignatureDrawPad onSignatureReady={handleSignatureReady} height={160} />
              ) : (
                <SignatureUpload onSignatureReady={handleSignatureReady} />
              )}
            </div>

            {/* Size Control */}
            {signatureDataUrl && (
              <div className="p-6 bg-card border-2 border-foreground space-y-4">
                <span className="input-label">Signature Size: {signatureWidth}px</span>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={10}
                  value={signatureWidth}
                  onChange={handleWidthChange}
                  className="w-full accent-primary"
                />

                {/* Quick positions */}
                <div className="space-y-2">
                  <span className="input-label">Quick Positions</span>
                  <div className="flex flex-wrap gap-2">
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
                    <button
                      type="button"
                      onClick={setPositionCenter}
                      className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                    >
                      Center
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="info-box">
              <svg
                aria-hidden="true"
                className="w-5 h-5 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="text-sm">
                Signature will be added to all {pages.length} pages. This is a visual signature, not a cryptographic
                one.
              </span>
            </div>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding signature..." />}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleSign}
              disabled={isProcessing || !signatureDataUrl}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <SignatureIcon className="w-5 h-5" />
                  Sign {pages.length} Pages
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

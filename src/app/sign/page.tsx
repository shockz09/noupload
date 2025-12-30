"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages, PageGridLoading } from "@/components/pdf/pdf-page-preview";
import { addSignature, downloadBlob } from "@/lib/pdf-utils";
import { SignatureIcon, LoaderIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard } from "@/components/pdf/shared";

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

  // Drawing canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

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

  // Get proper canvas coordinates from mouse/touch event
  const getCanvasCoords = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    // Scale from CSS coordinates to canvas internal coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Set canvas internal size (2x for retina)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear with white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Set drawing style (scale line width for DPR)
      ctx.strokeStyle = "#1A1612";
      ctx.lineWidth = 2 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    // Initialize after layout
    requestAnimationFrame(() => {
      requestAnimationFrame(initCanvas);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      initCanvas();
      setHasDrawn(false);
    });
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [signatureMode]);

  // Drawing functions
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const { x, y } = getCanvasCoords(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Clear entire canvas
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Reset drawing style
    ctx.strokeStyle = "#1A1612";
    ctx.lineWidth = 2 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    setHasDrawn(false);
    setSignatureDataUrl(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert to PNG with transparency
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Draw the signature
    tempCtx.drawImage(canvas, 0, 0);

    // Make white pixels transparent
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // If pixel is white-ish, make it transparent
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        data[i + 3] = 0;
      }
    }
    tempCtx.putImageData(imageData, 0, 0);

    setSignatureDataUrl(tempCanvas.toDataURL("image/png"));
  };

  // Handle signature image upload
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSignatureDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(uploadedFile);
  };

  // Position from event
  const getPositionFromEvent = (clientX: number, clientY: number) => {
    if (!previewRef.current) return null;
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = 100 - ((clientY - rect.top) / rect.height) * 100;
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

  const handleSign = async () => {
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

      const baseName = file.name.replace(".pdf", "");
      setResult({
        data,
        filename: `${baseName}_signed.pdf`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign PDF");
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
    setSignatureDataUrl(null);
    setHasDrawn(false);
    setPosition({ x: 70, y: 10 });
  };

  const previewPage = pages[0];

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
                onClick={() => setSignatureMode("draw")}
                className={`flex-1 py-3 px-4 font-bold transition-colors ${
                  signatureMode === "draw"
                    ? "bg-primary text-white"
                    : "bg-card hover:bg-accent"
                }`}
              >
                Draw Signature
              </button>
              <button
                onClick={() => setSignatureMode("upload")}
                className={`flex-1 py-3 px-4 font-bold border-l-2 border-foreground transition-colors ${
                  signatureMode === "upload"
                    ? "bg-primary text-white"
                    : "bg-card hover:bg-accent"
                }`}
              >
                Upload Image
              </button>
            </div>

            {/* Signature Area */}
            <div className="p-6 bg-card border-2 border-foreground space-y-4">
              {signatureMode === "draw" ? (
                <>
                  <div className="flex items-center justify-between">
                    <label className="input-label">Draw your signature</label>
                    <button
                      onClick={clearCanvas}
                      className="text-sm font-semibold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Clear
                    </button>
                  </div>

                  {/* Drawing Canvas */}
                  <div className="border-2 border-dashed border-foreground/30 bg-white">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-40 cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>

                  <button
                    onClick={saveSignature}
                    disabled={!hasDrawn}
                    className="btn-secondary w-full"
                  >
                    {signatureDataUrl ? "Update Signature" : "Use This Signature"}
                  </button>
                </>
              ) : (
                <>
                  <label className="input-label">Upload signature image</label>
                  <p className="text-sm text-muted-foreground">
                    PNG with transparent background works best
                  </p>

                  {signatureDataUrl ? (
                    <div className="space-y-4">
                      <div className="p-4 border-2 border-foreground bg-white flex items-center justify-center">
                        <img
                          src={signatureDataUrl}
                          alt="Uploaded signature"
                          className="max-h-32 max-w-full"
                        />
                      </div>
                      <button
                        onClick={() => setSignatureDataUrl(null)}
                        className="btn-secondary w-full"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Remove & Upload New
                      </button>
                    </div>
                  ) : (
                    <label className="block cursor-pointer">
                      <div className="border-2 border-dashed border-foreground/30 p-8 text-center hover:border-primary hover:bg-accent/50 transition-colors">
                        <UploadIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="font-medium">Click to upload</p>
                        <p className="text-sm text-muted-foreground">PNG, JPG, or GIF</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </>
              )}
            </div>

            {/* Size Control */}
            {signatureDataUrl && (
              <div className="p-6 bg-card border-2 border-foreground space-y-4">
                <label className="input-label">Signature Size: {signatureWidth}px</label>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={10}
                  value={signatureWidth}
                  onChange={(e) => setSignatureWidth(Number(e.target.value))}
                  className="w-full accent-primary"
                />

                {/* Quick positions */}
                <div className="space-y-2">
                  <label className="input-label">Quick Positions</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPosition({ x: 70, y: 10 })}
                      className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                    >
                      Bottom Right
                    </button>
                    <button
                      onClick={() => setPosition({ x: 30, y: 10 })}
                      className="px-3 py-1.5 text-xs font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
                    >
                      Bottom Left
                    </button>
                    <button
                      onClick={() => setPosition({ x: 50, y: 50 })}
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
              <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="text-sm">
                Signature will be added to all {pages.length} pages. This is a visual signature, not a cryptographic one.
              </span>
            </div>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding signature..." />}

            {/* Action Button */}
            <button
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

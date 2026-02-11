"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { TrashIcon } from "@/components/icons";

interface SignatureDrawPadProps {
  onSignatureReady: (dataUrl: string) => void;
  height?: number;
  className?: string;
}

export const SignatureDrawPad = memo(function SignatureDrawPad({
  onSignatureReady,
  height = 160,
  className = "",
}: SignatureDrawPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Get proper canvas coordinates from mouse/touch event
  const getCanvasCoords = useCallback((canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
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
  }, []);

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
  }, []);

  // Drawing functions
  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setIsDrawing(true);
      setHasDrawn(true);

      const { x, y } = getCanvasCoords(canvas, e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [getCanvasCoords],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { x, y } = getCanvasCoords(canvas, e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getCanvasCoords],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
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
  }, []);

  const saveSignature = useCallback(() => {
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

    onSignatureReady(tempCanvas.toDataURL("image/png"));
  }, [onSignatureReady]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Draw your signature below</span>
        <button
          type="button"
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
          className="w-full cursor-crosshair touch-none"
          style={{ height }}
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
        type="button"
        onClick={saveSignature}
        disabled={!hasDrawn}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Use This Signature
      </button>
    </div>
  );
});

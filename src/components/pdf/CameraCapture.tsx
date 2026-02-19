"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, LoaderIcon, XIcon } from "@/components/icons";
import { DocumentCropper } from "@/components/pdf/DocumentCropper";
import { detectDocument } from "@/lib/document-scanner";

interface Point {
  x: number;
  y: number;
}

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  maxImages: number;
  currentCount: number;
}

export function CameraCapture({ onCapture, onClose, maxImages, currentCount }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedCorners, setDetectedCorners] = useState<Point[] | undefined>(undefined);
  const [isDetecting, setIsDetecting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const remainingSlots = maxImages - currentCount;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please allow camera permissions.");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || remainingSlots <= 0) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvasRef.current = canvas;

    // Stop camera to save battery while reviewing
    stopCamera();

    // Show preview
    const previewUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(previewUrl);

    // Auto-detect document corners
    setIsDetecting(true);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detected = await detectDocument(imageData);
      
      if (detected && detected.confidence > 0.3) {
        // Convert absolute coordinates to relative (0-1)
        const relativeCorners = detected.corners.map(corner => ({
          x: corner.x / canvas.width,
          y: corner.y / canvas.height,
        }));
        setDetectedCorners(relativeCorners);
      } else {
        // No document detected, use default corners
        setDetectedCorners(undefined);
      }
    } catch (err) {
      console.error("Document detection failed:", err);
      setDetectedCorners(undefined);
    } finally {
      setIsDetecting(false);
    }
  }, [remainingSlots, stopCamera]);

  const handleConfirmCrop = useCallback(async (corners: Point[]) => {
    if (!canvasRef.current || !capturedImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Create output canvas for perspective transform
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = 800;
    outputCanvas.height = 1100;
    const outputCtx = outputCanvas.getContext("2d");
    if (!outputCtx) return;

    // Sort corners: top-left, top-right, bottom-right, bottom-left
    const sorted = sortCorners(corners);

    // Calculate source dimensions
    const srcWidth = Math.max(
      Math.hypot(sorted[1].x - sorted[0].x, sorted[1].y - sorted[0].y),
      Math.hypot(sorted[2].x - sorted[3].x, sorted[2].y - sorted[3].y)
    );
    const srcHeight = Math.max(
      Math.hypot(sorted[3].x - sorted[0].x, sorted[3].y - sorted[0].y),
      Math.hypot(sorted[2].x - sorted[1].x, sorted[2].y - sorted[1].y)
    );

    // Draw the transformed image
    outputCtx.drawImage(
      canvas,
      sorted[0].x, sorted[0].y,
      srcWidth, srcHeight,
      0, 0,
      outputCanvas.width, outputCanvas.height
    );

    // Apply enhancement
    const imageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    enhanceDocument(imageData);
    outputCtx.putImageData(imageData, 0, 0);

    // Convert to blob
    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          // Reset for next capture
          setCapturedImage(null);
          setDetectedCorners(undefined);
          canvasRef.current = null;
          startCamera();
        }
      },
      "image/jpeg",
      0.92
    );
  }, [capturedImage, onCapture, startCamera]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setDetectedCorners(undefined);
    canvasRef.current = null;
    startCamera();
  }, [startCamera]);

  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as { torch?: boolean };

    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !flashEnabled } as MediaTrackConstraintSet],
        });
        setFlashEnabled(!flashEnabled);
      } catch {
        // Torch not supported
      }
    }
  }, [flashEnabled]);

  if (error) {
    return (
      <div className="border-2 border-foreground bg-card p-8 text-center space-y-4">
        <div className="error-box">
          <AlertIcon className="w-5 h-5" />
          <span className="font-medium">{error}</span>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary">
          Go Back
        </button>
      </div>
    );
  }

  // Show cropper if we have a captured image
  if (capturedImage) {
    return (
      <>
        {isDetecting && (
          <div className="border-2 border-foreground bg-card p-8 text-center space-y-4">
            <LoaderIcon className="w-10 h-10 animate-spin mx-auto" />
            <p className="font-medium">Detecting document edges...</p>
          </div>
        )}
        <DocumentCropper
          imageSrc={capturedImage}
          detectedCorners={detectedCorners}
          onConfirm={handleConfirmCrop}
          onRetake={handleRetake}
        />
      </>
    );
  }

  return (
    <div className="border-2 border-foreground bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-foreground">
        <div className="flex items-center gap-3">
          <span className="file-number">{currentCount}</span>
          <span className="font-bold">of {maxImages} pages</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative bg-black">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <LoaderIcon className="w-8 h-8 animate-spin text-white" />
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full aspect-[4/3] object-cover"
          onLoadedMetadata={() => setIsLoading(false)}
        />
      </div>

      {/* Controls */}
      <div className="p-6 bg-card border-t-2 border-foreground">
        <div className="flex items-center justify-center gap-6">
          {/* Flash toggle */}
          <button
            type="button"
            onClick={toggleFlash}
            className={`w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center transition-all
              ${flashEnabled ? "bg-primary text-white" : "bg-muted hover:bg-accent"}
            `}
            title="Toggle flash"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>

          {/* Shutter button */}
          <button
            type="button"
            onClick={handleCapture}
            disabled={remainingSlots <= 0 || isLoading}
            className={`w-20 h-20 rounded-full border-4 border-foreground flex items-center justify-center transition-all
              ${remainingSlots > 0 && !isLoading
                ? "bg-white hover:scale-105 active:scale-95"
                : "bg-muted cursor-not-allowed"
              }
            `}
          >
            <div className={`w-16 h-16 rounded-full ${remainingSlots > 0 ? "bg-primary" : "bg-muted-foreground"}`} />
          </button>

          {/* Spacer for alignment */}
          <div className="w-12" />
        </div>

        {remainingSlots <= 0 && (
          <p className="text-center text-sm font-medium text-destructive mt-4">
            Maximum {maxImages} pages reached
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground mt-4">
          Position document in frame and tap to capture
        </p>
      </div>
    </div>
  );
}

// Helper functions
function sortCorners(corners: Point[]): Point[] {
  // Calculate centroid
  const centroid = corners.reduce(
    (acc, corner) => ({ x: acc.x + corner.x / 4, y: acc.y + corner.y / 4 }),
    { x: 0, y: 0 }
  );

  // Sort by angle from centroid
  return [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
    return angleA - angleB;
  });
}

function enhanceDocument(imageData: ImageData): void {
  const data = imageData.data;
  const length = data.length;

  // Apply adaptive contrast
  const contrast = 1.3;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < length; i += 4) {
    for (let j = 0; j < 3; j++) {
      data[i + j] = Math.max(0, Math.min(255, data[i + j] * contrast + intercept));
    }
  }
}

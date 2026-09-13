import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, LoaderIcon, XIcon } from "@/components/icons/ui";
import { DocumentCropper } from "@/components/pdf/DocumentCropper";
import { detectDocument, enhanceDocument, type Point, rectifyDocument } from "@/lib/document-scanner";

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
  const [cropError, setCropError] = useState<string | null>(null);
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

    // Auto-detect document corners. Failing to find a page is ordinary — the
    // cropper falls back to its default inset quad and the user drags it.
    setIsDetecting(true);
    try {
      const detected = await detectDocument(canvas);

      if (detected) {
        // The cropper works in 0-1 image space so it survives a resize.
        setDetectedCorners(
          detected.corners.map((corner) => ({
            x: corner.x / canvas.width,
            y: corner.y / canvas.height,
          })),
        );
      } else {
        setDetectedCorners(undefined);
      }
    } catch (err) {
      console.error("Document detection failed:", err);
      setDetectedCorners(undefined);
    } finally {
      setIsDetecting(false);
    }
  }, [remainingSlots, stopCamera]);

  const handleConfirmCrop = useCallback(
    async (corners: Point[]) => {
      if (!canvasRef.current || !capturedImage) return;

      let flattened: HTMLCanvasElement;
      try {
        setCropError(null);
        flattened = await rectifyDocument(canvasRef.current, sortCorners(corners));
      } catch (err) {
        // Recoverable: the photo is still there, so leave the cropper up rather
        // than falling through to the fatal camera-error screen.
        console.error("Page extraction failed:", err);
        setCropError("Could not flatten that page. Move the corners, or retake the photo.");
        return;
      }

      const ctx = flattened.getContext("2d");
      if (!ctx) return;

      ctx.putImageData(enhanceDocument(ctx.getImageData(0, 0, flattened.width, flattened.height)), 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => flattened.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) return;

      onCapture(blob);
      setCapturedImage(null);
      setDetectedCorners(undefined);
      canvasRef.current = null;
      startCamera();
    },
    [capturedImage, onCapture, startCamera],
  );

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setDetectedCorners(undefined);
    setCropError(null);
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
        {cropError && (
          <div className="error-box">
            <AlertIcon className="w-5 h-5" />
            <span className="font-medium">{cropError}</span>
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
      <div className="relative bg-black" style={{ height: "50vh", minHeight: "300px" }}>
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
          className="w-full h-full object-contain"
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
              ${
                remainingSlots > 0 && !isLoading
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
          <p className="text-center text-sm font-medium text-destructive mt-4">Maximum {maxImages} pages reached</p>
        )}

        <p className="text-center text-sm text-muted-foreground mt-4">Position document in frame and tap to capture</p>
      </div>
    </div>
  );
}

/**
 * Put the four corners in top-left, top-right, bottom-right, bottom-left order.
 *
 * The cropper hands them back in whatever order the user last dragged them, and
 * the warp needs to know which corner is which. Sorting by angle about the
 * centroid gives that for any convex quad: atan2 runs from -pi on the left, so
 * ascending order starts at the top-left and goes clockwise.
 */
function sortCorners(corners: Point[]): Point[] {
  const centroid = corners.reduce((acc, corner) => ({ x: acc.x + corner.x / 4, y: acc.y + corner.y / 4 }), {
    x: 0,
    y: 0,
  });

  return [...corners].sort(
    (a, b) => Math.atan2(a.y - centroid.y, a.x - centroid.x) - Math.atan2(b.y - centroid.y, b.x - centroid.x),
  );
}

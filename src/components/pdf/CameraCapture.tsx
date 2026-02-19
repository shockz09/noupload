"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, LoaderIcon, XIcon } from "@/components/icons";

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

  const handleCapture = useCallback(() => {
    if (!videoRef.current || remainingSlots <= 0) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
        }
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, remainingSlots]);

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
          <div className="absolute inset-0 flex items-center justify-center bg-black">
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

        {/* Scan overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner brackets */}
          <div className="absolute top-6 left-6 w-16 h-16 border-l-4 border-t-4 border-primary" />
          <div className="absolute top-6 right-6 w-16 h-16 border-r-4 border-t-4 border-primary" />
          <div className="absolute bottom-6 left-6 w-16 h-16 border-l-4 border-b-4 border-primary" />
          <div className="absolute bottom-6 right-6 w-16 h-16 border-r-4 border-b-4 border-primary" />
        </div>
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
      </div>
    </div>
  );
}

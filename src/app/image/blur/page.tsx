"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlurIcon, ImageIcon } from "@/components/icons/image";
import { ErrorBox, ImageFileInfo, ImagePageHeader, ProgressBar, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import {
  applyBlurRegions,
  type BlurRegion,
  type BlurType,
  copyImageToClipboard,
  formatFileSize,
  getOutputFilename,
} from "@/lib/image-utils";

interface RegionWithId extends BlurRegion {
  id: string;
}

export default function ImageBlurPage() {
  const [file, setFile] = useState<File | null>(null);
  const [blurType, setBlurType] = useState<BlurType>("pixelate");
  const [intensity, setIntensity] = useState(20);
  const [regions, setRegions] = useState<RegionWithId[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<BlurRegion | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult();

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();
        setRegions([]);
        setPreview(selectedFile);

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(selectedFile);
      }
    },
    [clearResult, setPreview],
  );

  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setRegions([]);
    setImageDimensions(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const getScaledCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !imageDimensions) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = imageDimensions.width / rect.width;
      const scaleY = imageDimensions.height / rect.height;

      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY),
      };
    },
    [imageDimensions],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getScaledCoords(e);
      if (!coords) return;

      setIsDrawing(true);
      setDrawStart(coords);
      setCurrentRegion({ x: coords.x, y: coords.y, width: 0, height: 0 });
    },
    [getScaledCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !drawStart) return;

      const coords = getScaledCoords(e);
      if (!coords) return;

      const x = Math.min(drawStart.x, coords.x);
      const y = Math.min(drawStart.y, coords.y);
      const width = Math.abs(coords.x - drawStart.x);
      const height = Math.abs(coords.y - drawStart.y);

      setCurrentRegion({ x, y, width, height });
    },
    [isDrawing, drawStart, getScaledCoords],
  );

  const handleMouseUp = useCallback(() => {
    if (currentRegion && currentRegion.width > 10 && currentRegion.height > 10) {
      setRegions((prev) => [...prev, { ...currentRegion, id: crypto.randomUUID() }]);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentRegion(null);
  }, [currentRegion]);

  const handleRemoveRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleApply = useCallback(async () => {
    if (!file || regions.length === 0 || !startProcessing()) return;

    try {
      setProgress(30);
      const blob = await applyBlurRegions(file, regions, blurType, intensity);
      setProgress(90);
      setResult(blob, getOutputFilename(file.name, undefined, "_blurred"));
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to apply blur"));
    } finally {
      stopProcessing();
    }
  }, [file, regions, blurType, intensity, startProcessing, setProgress, setResult, setError, stopProcessing]);

  // Draw canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageDimensions) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = imageDimensions.width;
    canvas.height = imageDimensions.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing regions
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    regions.forEach((region) => {
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(region.x, region.y, region.width, region.height);
    });

    // Draw current region being drawn
    if (currentRegion) {
      ctx.strokeStyle = "#3b82f6";
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentRegion.x, currentRegion.y, currentRegion.width, currentRegion.height);
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
      ctx.fillRect(currentRegion.x, currentRegion.y, currentRegion.width, currentRegion.height);
    }
  }, [regions, currentRegion, imageDimensions]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    setRegions([]);
    setImageDimensions(null);
    clearResult();
  }, [revokePreview, clearResult]);

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<BlurIcon className="w-7 h-7" />}
        iconClass="tool-blur"
        title="Blur & Pixelate"
        description="Hide sensitive areas in images"
      />

      {result ? (
        <SuccessCard
          stampText="Protected"
          title="Image Protected!"
          subtitle={`${regions.length} area${regions.length !== 1 ? "s" : ""} blurred`}
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Blur Another Image"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your image here"
            subtitle="or click to browse · Ctrl+V to paste"
          />
          <InfoBox title="Privacy Protection">
            Draw rectangles over sensitive areas like faces, license plates, or personal information. Choose between
            blur or pixelate effects.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div
                ref={containerRef}
                className="relative border-2 border-foreground bg-muted/30 overflow-hidden"
                style={{ cursor: "crosshair" }}
              >
                {preview && <img src={preview} alt="Preview" className="w-full h-auto block" draggable={false} />}
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Click and drag to select areas to blur</p>
            </div>

            <div className="space-y-4">
              <div>
                <span className="input-label block mb-2">Effect Type</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBlurType("pixelate")}
                    className={`flex-1 py-2 text-sm font-bold border-2 border-foreground transition-colors ${
                      blurType === "pixelate" ? "bg-foreground text-background" : "hover:bg-muted"
                    }`}
                  >
                    Pixelate
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlurType("gaussian")}
                    className={`flex-1 py-2 text-sm font-bold border-2 border-foreground transition-colors ${
                      blurType === "gaussian" ? "bg-foreground text-background" : "hover:bg-muted"
                    }`}
                  >
                    Blur
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="input-label">Intensity</span>
                  <span className="text-sm font-bold">{intensity}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>

              <div>
                <span className="input-label block mb-2">Regions ({regions.length})</span>
                {regions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No regions selected</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {regions.map((region, i) => (
                      <div key={region.id} className="flex items-center justify-between py-1 px-2 bg-muted/50 text-sm">
                        <span>Area {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRegion(region.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Applying blur..." />}

          <button
            type="button"
            onClick={handleApply}
            disabled={isProcessing || regions.length === 0}
            className="btn-primary w-full"
          >
            <BlurIcon className="w-5 h-5" />
            {isProcessing
              ? "Processing..."
              : `Apply ${blurType === "pixelate" ? "Pixelate" : "Blur"} to ${regions.length} Area${regions.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

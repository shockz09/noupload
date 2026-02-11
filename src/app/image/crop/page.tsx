"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CropIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import { ErrorBox, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import {
  type CropArea,
  copyImageToClipboard,
  cropImage,
  formatFileSize,
  getImageDimensions,
  getOutputFilename,
} from "@/lib/image-utils";

const aspectRatios = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
  { label: "2:3", value: 2 / 3 },
];

interface CropMetadata {
  width: number;
  height: number;
}

export default function ImageCropPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<CropMetadata>();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();
        setPreview(selectedFile);

        const dims = await getImageDimensions(selectedFile);
        setImageDimensions(dims);

        const initialSize = Math.min(dims.width, dims.height) * 0.8;
        setCropArea({
          x: (dims.width - initialSize) / 2,
          y: (dims.height - initialSize) / 2,
          width: initialSize,
          height: initialSize,
        });
      }
    },
    [clearResult, setPreview],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setImageDimensions(null);
    clearResult();
    setAspectRatio(null);
  }, [revokePreview, clearResult]);

  useEffect(() => {
    if (containerRef.current && imageDimensions) {
      const containerWidth = containerRef.current.clientWidth;
      const maxHeight = 400;
      const scaleX = containerWidth / imageDimensions.width;
      const scaleY = maxHeight / imageDimensions.height;
      setScale(Math.min(scaleX, scaleY, 1));
    }
  }, [imageDimensions]);

  useEffect(() => {
    if (aspectRatio && imageDimensions) {
      const currentArea = cropArea;
      let newWidth = currentArea.width;
      let newHeight = currentArea.width / aspectRatio;

      if (newHeight > imageDimensions.height) {
        newHeight = imageDimensions.height * 0.8;
        newWidth = newHeight * aspectRatio;
      }

      setCropArea({
        x: Math.max(0, (imageDimensions.width - newWidth) / 2),
        y: Math.max(0, (imageDimensions.height - newHeight) / 2),
        width: Math.min(newWidth, imageDimensions.width),
        height: Math.min(newHeight, imageDimensions.height),
      });
    }
  }, [aspectRatio, imageDimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    if (handle) {
      setIsResizing(handle);
    } else {
      setIsDragging(true);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!imageDimensions) return;

      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;

      if (isDragging) {
        setCropArea((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(imageDimensions.width - prev.width, prev.x + dx)),
          y: Math.max(0, Math.min(imageDimensions.height - prev.height, prev.y + dy)),
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (isResizing) {
        setCropArea((prev) => {
          const newArea = { ...prev };

          if (isResizing.includes("e"))
            newArea.width = Math.max(50, Math.min(imageDimensions.width - prev.x, prev.width + dx));
          if (isResizing.includes("s"))
            newArea.height = Math.max(50, Math.min(imageDimensions.height - prev.y, prev.height + dy));
          if (isResizing.includes("w")) {
            const newX = Math.max(0, prev.x + dx);
            newArea.width = prev.width - (newX - prev.x);
            newArea.x = newX;
          }
          if (isResizing.includes("n")) {
            const newY = Math.max(0, prev.y + dy);
            newArea.height = prev.height - (newY - prev.y);
            newArea.y = newY;
          }

          if (aspectRatio) {
            newArea.height = newArea.width / aspectRatio;
            if (newArea.y + newArea.height > imageDimensions.height) {
              newArea.height = imageDimensions.height - newArea.y;
              newArea.width = newArea.height * aspectRatio;
            }
          }

          return newArea;
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [isDragging, isResizing, dragStart, scale, imageDimensions, aspectRatio],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleCrop = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const cropped = await cropImage(file, {
        x: Math.round(cropArea.x),
        y: Math.round(cropArea.y),
        width: Math.round(cropArea.width),
        height: Math.round(cropArea.height),
      });
      setResult(cropped, getOutputFilename(file.name, undefined, "_cropped"), {
        width: Math.round(cropArea.width),
        height: Math.round(cropArea.height),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to crop image");
    } finally {
      stopProcessing();
    }
  }, [file, cropArea, startProcessing, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    revokePreview();
    setFile(null);
    setImageDimensions(null);
    clearResult();
    setAspectRatio(null);
  }, [revokePreview, clearResult]);

  const handleAspectRatioSelect = useCallback((value: number | null) => {
    setAspectRatio(value);
  }, []);

  const containerHeight = useMemo(
    () => (imageDimensions ? Math.min(400, imageDimensions.height * scale) : 0),
    [imageDimensions, scale],
  );

  const cropBoxStyle = useMemo(
    () =>
      imageDimensions
        ? {
            left: `calc(50% - ${(imageDimensions.width / 2 - cropArea.x) * scale}px)`,
            top: `calc(50% - ${(imageDimensions.height / 2 - cropArea.y) * scale}px)`,
            width: cropArea.width * scale,
            height: cropArea.height * scale,
          }
        : {},
    [imageDimensions, cropArea, scale],
  );

  const imageStyle = useMemo(
    () =>
      imageDimensions
        ? {
            width: imageDimensions.width * scale,
            height: imageDimensions.height * scale,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }
        : {},
    [imageDimensions, scale],
  );

  return (
    <div className="page-enter max-w-3xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<CropIcon className="w-7 h-7" />}
        iconClass="tool-crop"
        title="Crop Image"
        description="Crop images with custom aspect ratios"
      />

      {result ? (
        <SuccessCard
          stampText="Cropped"
          title="Image Cropped!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Crop Another"
        >
          <p className="text-muted-foreground">
            New size: {result.metadata?.width}×{result.metadata?.height} • {formatFileSize(result.blob.size)}
          </p>
        </SuccessCard>
      ) : !file ? (
        <FileDropzone
          accept=".jpg,.jpeg,.png,.webp"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your image here"
          subtitle="or click to browse · Ctrl+V to paste"
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <span className="input-label">Aspect Ratio</span>
            <div className="flex flex-wrap gap-2">
              {aspectRatios.map((ar) => (
                <button
                  type="button"
                  key={ar.label}
                  onClick={() => handleAspectRatioSelect(ar.value)}
                  className={`px-4 py-2 text-sm font-bold border-2 border-foreground transition-colors ${
                    aspectRatio === ar.value ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {preview && imageDimensions && (
            <div
              ref={containerRef}
              className="relative border-2 border-foreground bg-[#1a1a1a] overflow-hidden"
              style={{ height: containerHeight }}
            >
              <img
                src={preview}
                alt="To crop"
                className="absolute"
                style={imageStyle}
                draggable={false}
                loading="lazy"
                decoding="async"
              />

              <div
                className="absolute border-2 border-white cursor-move"
                style={cropBoxStyle}
                onMouseDown={(e) => handleMouseDown(e)}
              >
                {["nw", "ne", "sw", "se", "n", "s", "e", "w"].map((handle) => (
                  <div
                    key={handle}
                    className="absolute w-3 h-3 bg-white border border-black"
                    style={{
                      cursor: `${handle}-resize`,
                      ...(handle.includes("n") ? { top: -6 } : {}),
                      ...(handle.includes("s") ? { bottom: -6 } : {}),
                      ...(handle.includes("w") ? { left: -6 } : {}),
                      ...(handle.includes("e") ? { right: -6 } : {}),
                      ...(handle === "n" || handle === "s" ? { left: "50%", transform: "translateX(-50%)" } : {}),
                      ...(handle === "e" || handle === "w" ? { top: "50%", transform: "translateY(-50%)" } : {}),
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, handle);
                    }}
                  />
                ))}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                </div>
              </div>
            </div>
          )}

          <div className="file-item">
            <div className="pdf-icon-box">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                Selection: {Math.round(cropArea.width)}×{Math.round(cropArea.height)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Change file
            </button>
          </div>

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground py-4">
              <LoaderIcon className="w-4 h-4" />
              <span>Cropping image...</span>
            </div>
          )}

          <button type="button" onClick={handleCrop} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Processing...
              </>
            ) : (
              <>
                <CropIcon className="w-5 h-5" />
                Crop Image
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

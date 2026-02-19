"use client";

import { useCallback, useRef, useState } from "react";
import { CameraIcon, FileIcon, GripIcon, LoaderIcon, UploadIcon, XIcon } from "@/components/icons";
import { CameraCapture } from "@/components/pdf/CameraCapture";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { imagesToPdf } from "@/lib/pdf-image-utils";

interface ImageItem {
  file: File;
  id: string;
  preview: string;
  rotation: number; // 0, 90, 180, 270
}

interface ConvertResult {
  data: Uint8Array;
  filename: string;
  pageCount: number;
}

const MAX_IMAGES = 20;

type InputMode = "upload" | "camera";

export default function ImagesToPdfPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [pageSize, setPageSize] = useState<"a4" | "letter" | "fit">("a4");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [showCamera, setShowCamera] = useState(false);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const remainingSlots = MAX_IMAGES - images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    const newItems: ImageItem[] = [];

    for (const file of filesToProcess) {
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newItems.push({
        file,
        id: crypto.randomUUID(),
        preview,
        rotation: 0,
      });
    }

    setImages((prev) => [...prev, ...newItems]);
    setError(null);
    setResult(null);
  }, [images.length]);

  const handleCameraCapture = useCallback((blob: Blob) => {
    const file = new File([blob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
    const preview = URL.createObjectURL(blob);

    setImages((prev) => [
      ...prev,
      {
        file,
        id: crypto.randomUUID(),
        preview,
        rotation: 0,
      },
    ]);
  }, []);

  const handleRotate = useCallback((id: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img)));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      const [moved] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, moved);
      return newImages;
    });
  }, []);

  const handleClear = useCallback(() => {
    setImages([]);
    setError(null);
    setResult(null);
    setShowCamera(false);
  }, []);

  const handleConvert = useCallback(async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const data = await imagesToPdf(
        images.map((i) => i.file),
        {
          pageSize,
          rotations: images.map((i) => i.rotation),
          onProgress: (current, total) => {
            setProgress(Math.round((current / total) * 100));
          },
        },
      );

      setResult({
        data,
        filename: "document.pdf",
        pageCount: images.length,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create PDF"));
    } finally {
      setIsProcessing(false);
    }
  }, [images, pageSize]);

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
    setImages([]);
    setResult(null);
    setError(null);
    setProgress(0);
    setShowCamera(false);
  }, []);

  // Page size handlers
  const setPageSizeA4 = useCallback(() => setPageSize("a4"), []);
  const setPageSizeLetter = useCallback(() => setPageSize("letter"), []);
  const setPageSizeFit = useCallback(() => setPageSize("fit"), []);

  // Input mode handlers
  const setUploadMode = useCallback(() => {
    setInputMode("upload");
    setShowCamera(false);
  }, []);

  const setCameraMode = useCallback(() => {
    setInputMode("camera");
    setShowCamera(true);
  }, []);

  const closeCamera = useCallback(() => {
    setShowCamera(false);
  }, []);

  // Ref for file input in "Upload More" flow
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadMoreFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        await handleFilesSelected(files);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFilesSelected]
  );

  // Use ref to store handleReorder for stable reference in drag handler
  const handleReorderRef = useRef(handleReorder);
  handleReorderRef.current = handleReorder;

  const handleDragStart = useCallback((e: React.DragEvent, index: number, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (fromIndex !== toIndex) {
      handleReorderRef.current(fromIndex, toIndex);
    }
    setDraggingId(null);
  }, []);

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div className="page-enter max-w-5xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<FileIcon className="w-7 h-7" />}
        iconClass="tool-images-to-pdf"
        title="Images to PDF"
        description="Combine multiple images into a single PDF"
      />

      {result ? (
        <div className="max-w-2xl mx-auto">
          <SuccessCard
            stampText="Complete"
            title="PDF Created!"
            downloadLabel="Download PDF"
            onDownload={handleDownload}
            onStartOver={handleStartOver}
            startOverLabel="Create Another PDF"
          >
            <p className="text-muted-foreground">{result.pageCount} page{result.pageCount !== 1 ? 's' : ''} scanned into one PDF</p>
          </SuccessCard>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Mode Toggle - Only show when no images */}
          {!showCamera && images.length === 0 && (
            <div className="p-2 bg-card border-2 border-foreground">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={setUploadMode}
                  className={`flex-1 py-3 px-4 border-2 font-bold transition-all flex items-center justify-center gap-2
                    ${inputMode === "upload" ? "bg-primary border-foreground text-white" : "bg-muted border-transparent hover:bg-accent"}
                  `}
                >
                  <UploadIcon className="w-5 h-5" />
                  Upload Files
                </button>
                <button
                  type="button"
                  onClick={setCameraMode}
                  className={`flex-1 py-3 px-4 border-2 font-bold transition-all flex items-center justify-center gap-2
                    ${inputMode === "camera" ? "bg-primary border-foreground text-white" : "bg-muted border-transparent hover:bg-accent"}
                  `}
                >
                  <CameraIcon className="w-5 h-5" />
                  Scan with Camera
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          {!showCamera && images.length === 0 && inputMode === "upload" && (
            <FileDropzone
              accept=".jpg,.jpeg,.png,.gif,.webp,.bmp"
              multiple
              onFilesSelected={handleFilesSelected}
              maxFiles={MAX_IMAGES}
              title="Drop your images here"
              subtitle="JPG, PNG, GIF, WebP, BMP"
            />
          )}

          {/* Camera Capture */}
          {showCamera && (
            <CameraCapture
              onCapture={handleCameraCapture}
              onClose={closeCamera}
              maxImages={MAX_IMAGES}
              currentCount={images.length}
            />
          )}

          {/* Add More Button */}
          {images.length > 0 && canAddMore && !showCamera && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex-1 py-4 border-2 border-foreground bg-card hover:bg-accent transition-all font-bold flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-5 h-5" />
                Scan More Pages
              </button>
              <button
                type="button"
                onClick={triggerFileUpload}
                className="flex-1 py-4 border-2 border-foreground bg-card hover:bg-accent transition-all font-bold flex items-center justify-center gap-2"
              >
                <UploadIcon className="w-5 h-5" />
                Upload More
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.bmp"
                multiple
                className="hidden"
                onChange={handleUploadMoreFiles}
              />
            </div>
          )}

          {images.length > 0 && (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border-2 border-foreground">
                <div className="flex items-center gap-3">
                  <div className="file-number">{images.length}</div>
                  <span className="font-bold">{images.length === 1 ? 'page' : 'pages'} captured</span>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm font-semibold text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear all
                </button>
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`relative group border-2 border-foreground overflow-hidden transition-all
                      ${draggingId === image.id ? "opacity-50 scale-95" : ""}
                    `}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, image.id)}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    {/* Clickable image for rotation */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRotate(image.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRotate(image.id);
                        }
                      }}
                      className="cursor-pointer w-full aspect-square flex items-center justify-center bg-muted/30 overflow-hidden"
                      title="Click to rotate"
                    >
                      <img
                        src={image.preview}
                        alt={`Page ${index + 1}`}
                        className="max-w-full max-h-full object-contain transition-transform duration-200"
                        style={{ transform: `rotate(${image.rotation}deg)` }}
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    {/* Page badge */}
                    <div className="absolute top-1 left-1 file-number text-xs">{index + 1}</div>
                    {/* Rotation badge */}
                    {image.rotation !== 0 && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold border border-foreground">
                        {image.rotation}°
                      </div>
                    )}
                    {/* Drag handle */}
                    <div className="absolute top-1 right-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
                      <GripIcon className="w-4 h-4 text-white drop-shadow" />
                    </div>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(image.id);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center font-medium">Click to rotate · Drag to reorder</p>

              {/* Page Size Options */}
              <div className="p-6 bg-card border-2 border-foreground space-y-3">
                <span className="input-label">Page Size</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={setPageSizeA4}
                    className={`px-6 py-3 border-2 font-bold transition-all flex-1
                      ${pageSize === "a4" ? "bg-primary border-foreground text-white" : "bg-muted border-foreground hover:bg-accent"}
                    `}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={setPageSizeLetter}
                    className={`px-6 py-3 border-2 font-bold transition-all flex-1
                      ${pageSize === "letter" ? "bg-primary border-foreground text-white" : "bg-muted border-foreground hover:bg-accent"}
                    `}
                  >
                    Letter
                  </button>
                  <button
                    type="button"
                    onClick={setPageSizeFit}
                    className={`px-6 py-3 border-2 font-bold transition-all flex-1
                      ${pageSize === "fit" ? "bg-primary border-foreground text-white" : "bg-muted border-foreground hover:bg-accent"}
                    `}
                  >
                    Fit to Image
                  </button>
                </div>
              </div>

              {error && <ErrorBox message={error} />}
              {isProcessing && <ProgressBar progress={progress} label={`Creating PDF... ${progress}%`} />}

              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing || images.length === 0}
                className="btn-primary w-full max-w-md mx-auto block"
              >
                {isProcessing ? (
                  <>
                    <LoaderIcon className="w-5 h-5" />
                    Creating PDF...
                  </>
                ) : (
                  <>
                    <FileIcon className="w-5 h-5" />
                    Create PDF from {images.length} {images.length === 1 ? 'Page' : 'Pages'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

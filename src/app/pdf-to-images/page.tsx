"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { pdfToImages, downloadImagesAsZip, downloadImage, ConvertedImage } from "@/lib/pdf-image-utils";
import { ImageIcon, DownloadIcon, LoaderIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, PdfFileInfo } from "@/components/pdf/shared";

export default function PdfToImagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<"png" | "jpeg">("jpeg"); // Default to JPEG (faster)
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [images, setImages] = useState<ConvertedImage[]>([]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
    };
  }, [images]);

  // Helper to cleanup images
  const cleanupImages = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.dataUrl));
  }, [images]);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      cleanupImages();
      setFile(files[0]);
      setError(null);
      setImages([]);
    }
  }, [cleanupImages]);

  const handleClear = useCallback(() => {
    cleanupImages();
    setFile(null);
    setError(null);
    setImages([]);
  }, [cleanupImages]);

  // Optimized quality settings (lower scale = faster on mobile)
  const qualitySettings = {
    low: { scale: 1, jpegQuality: 0.7 },      // Fast, smaller files
    medium: { scale: 1.5, jpegQuality: 0.85 }, // Balanced (was 2)
    high: { scale: 2, jpegQuality: 0.92 },     // High quality (was 3)
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setImages([]);

    try {
      const settings = qualitySettings[quality];
      const result = await pdfToImages(file, {
        format,
        quality: settings.jpegQuality,
        scale: settings.scale,
        onProgress: (current, total) => {
          setProgress(Math.round((current / total) * 100));
        },
      });

      setImages(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAll = () => {
    if (file && images.length > 0) {
      const baseName = file.name.replace(".pdf", "");
      downloadImagesAsZip(images, baseName, format);
    }
  };

  const handleDownloadSingle = (image: ConvertedImage) => {
    if (file) {
      const baseName = file.name.replace(".pdf", "");
      const ext = format === "png" ? "png" : "jpg";
      downloadImage(image.blob, `${baseName}_page${image.pageNumber}.${ext}`);
    }
  };

  const handleStartOver = () => {
    cleanupImages();
    setFile(null);
    setImages([]);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="page-enter max-w-5xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<ImageIcon className="w-7 h-7" />}
        iconClass="tool-pdf-to-images"
        title="PDF to Images"
        description="Convert each page to high-quality images"
      />

      {/* Main Content */}
      {!file ? (
        <div className="max-w-2xl mx-auto">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />
        </div>
      ) : images.length === 0 ? (
        <div className="space-y-6 max-w-2xl mx-auto">
          <PdfFileInfo
            file={file}
            fileSize=""
            onClear={handleClear}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            }
          />

          {/* Options */}
          <div className="p-6 bg-card border-2 border-foreground space-y-6">
            <div className="space-y-3">
              <label className="input-label">Image Format</label>
              <div className="flex gap-2">
                {(["png", "jpeg"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-6 py-3 border-2 font-bold transition-all
                      ${format === f
                        ? "bg-primary border-foreground text-white"
                        : "bg-muted border-foreground hover:bg-accent"
                      }
                    `}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG: Lossless, larger files. JPEG: Smaller files, slight quality loss.
              </p>
            </div>

            <div className="space-y-3">
              <label className="input-label">Quality</label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`px-6 py-3 border-2 font-bold transition-all flex-1
                      ${quality === q
                        ? "bg-primary border-foreground text-white"
                        : "bg-muted border-foreground hover:bg-accent"
                      }
                    `}
                  >
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Higher quality = larger file size and longer processing time.
              </p>
            </div>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label={`Converting pages... ${progress}%`} />}

          <button
            onClick={handleConvert}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Converting...
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                Convert to Images
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border-2 border-foreground">
            <div className="flex items-center gap-3">
              <div className="file-number">{images.length}</div>
              <span className="font-bold">images generated</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDownloadAll} className="btn-success">
                <DownloadIcon className="w-5 h-5" />
                Download All
              </button>
              <button onClick={handleStartOver} className="btn-secondary">
                Start Over
              </button>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((image) => (
              <div
                key={image.pageNumber}
                className="group relative bg-white border-2 border-foreground overflow-hidden"
              >
                <img
                  src={image.dataUrl}
                  alt={`Page ${image.pageNumber}`}
                  className="w-full h-auto block"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-foreground/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleDownloadSingle(image)}
                    className="px-4 py-2 bg-white text-foreground font-bold text-sm border-2 border-white hover:bg-accent transition-colors"
                  >
                    Download
                  </button>
                </div>
                {/* Page number */}
                <div className="absolute bottom-0 left-0 right-0 bg-foreground text-white text-xs font-bold py-1 text-center">
                  Page {image.pageNumber}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

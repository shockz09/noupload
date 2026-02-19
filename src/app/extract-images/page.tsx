"use client";

import { useCallback, useState } from "react";
import { DownloadIcon, ExtractImageIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useFileProcessing } from "@/hooks";
import { downloadFile } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { extractImagesFromPDF } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface ExtractedImage {
  blob: Blob;
  name: string;
  url: string;
}

export default function ExtractImagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const selectedFile = files[0];
      setFile(selectedFile);
      setImages([]);

      if (!startProcessing()) return;

      try {
        setProgress(10);
        const baseName = getFileBaseName(selectedFile.name);

        const result = await extractImagesFromPDF(selectedFile, (current, total) => {
          setProgress(10 + Math.round((current / total) * 80));
        });

        setProgress(95);

        const extractedImages: ExtractedImage[] = result.images.map((blob, idx) => ({
          blob,
          name: `${baseName}_${result.names[idx]}`,
          url: URL.createObjectURL(blob),
        }));

        setImages(extractedImages);
        setProgress(100);

        if (extractedImages.length === 0) {
          setError("No extractable images found in this PDF");
        }
      } catch (err) {
        setError(getErrorMessage(err, "Failed to extract images"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleClear = useCallback(() => {
    // Revoke all object URLs
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setFile(null);
    setImages([]);
  }, [images]);

  const handleDownloadOne = useCallback((image: ExtractedImage) => {
    downloadFile(image.url, image.name);
  }, []);

  const handleDownloadAll = useCallback(() => {
    for (const image of images) {
      handleDownloadOne(image);
    }
  }, [images, handleDownloadOne]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<ExtractImageIcon className="w-7 h-7" />}
        iconClass="tool-extract-images"
        title="Extract Images"
        description="Pull all images from a PDF document"
      />

      {images.length > 0 ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Found</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">
                {images.length} Image{images.length !== 1 ? "s" : ""} Extracted!
              </h2>
              <p className="text-muted-foreground">Ready to download</p>
            </div>
            <button type="button" onClick={handleDownloadAll} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download All ({images.length} files)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {images.map((image) => (
              <div key={image.name} className="border-2 border-foreground bg-background overflow-hidden group">
                <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                  <img src={image.url} alt={image.name} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold truncate" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(image.blob.size)}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(image)}
                    className="text-xs font-bold text-primary hover:underline mt-1"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleClear} className="btn-secondary w-full">
            Extract from Another PDF
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF here"
            subtitle="to extract embedded images"
          />
          <InfoBox title="Image Extraction">
            Extracts all embedded images from your PDF. Works best with PDFs that contain JPEG or PNG images. Some
            image formats may not be extractable.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo file={file} fileSize={formatFileSize(file.size)} onClear={handleClear} />

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Extracting images..." />}
        </div>
      )}
    </div>
  );
}

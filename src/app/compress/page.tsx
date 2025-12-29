"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { compressPDF, downloadBlob } from "@/lib/pdf-utils";
import { CompressIcon, PdfIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard, PdfFileInfo, ComparisonDisplay, SavingsBadge } from "@/components/pdf/shared";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

interface CompressResult {
  data: Uint8Array;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);

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

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const compressed = await compressPDF(file);
      setProgress(90);

      const baseName = file.name.replace(".pdf", "");
      setResult({
        data: compressed,
        filename: `${baseName}_compressed.pdf`,
        originalSize: file.size,
        compressedSize: compressed.length,
      });

      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compress PDF");
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
    setProgress(0);
  };

  const savings = result
    ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
    : 0;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<CompressIcon className="w-7 h-7" />}
        iconClass="tool-compress"
        title="Compress PDF"
        description="Reduce file size while preserving quality"
      />

      {result ? (
        <SuccessCard
          stampText="Optimized"
          title="PDF Compressed!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={formatFileSize(result.originalSize)}
            newLabel="Compressed"
            newValue={formatFileSize(result.compressedSize)}
          />
          <SavingsBadge savings={savings} />
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          <div className="info-box">
            <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">About compression</p>
              <p className="text-muted-foreground">Client-side compression removes metadata and applies object stream optimization. For image-heavy PDFs, consider using dedicated tools.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<PdfIcon className="w-5 h-5" />}
          />

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Compressing..." />}

          <button onClick={handleCompress} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Compressing...</>
            ) : (
              <><CompressIcon className="w-5 h-5" />Compress PDF</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

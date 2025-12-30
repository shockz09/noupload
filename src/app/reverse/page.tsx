"use client";

import { useState, useCallback, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { reversePDF, getPDFPageCount, downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";
import { ReversePagesIcon, PdfIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard, PdfFileInfo } from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";

interface ReverseResult {
  data: Uint8Array;
  filename: string;
  pageCount: number;
}

export default function ReversePage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseResult | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const processingRef = useRef(false);

  const processFile = useCallback(async (fileToProcess: File) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(30);
      const data = await reversePDF(fileToProcess);
      const count = await getPDFPageCount(fileToProcess);
      setProgress(90);

      const baseName = fileToProcess.name.replace(/\.pdf$/i, "");
      setResult({
        data,
        filename: `${baseName}_reversed.pdf`,
        pageCount: count,
      });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reverse PDF");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, []);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      try {
        const count = await getPDFPageCount(selectedFile);
        setPageCount(count);
      } catch {
        setPageCount(0);
      } finally {
        if (isInstant) {
          processFile(selectedFile);
        }
      }
    }
  }, [isInstant, processFile]);

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setPageCount(0);
  }, []);

  const handleReverse = async () => {
    if (!file) return;
    processFile(file);
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
    setPageCount(0);
  };

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<ReversePagesIcon className="w-7 h-7" />}
        iconClass="tool-organize"
        title="Reverse Pages"
        description="Flip the order of all pages in your PDF"
      />

      {result ? (
        <SuccessCard
          stampText="Reversed"
          title="Pages Reversed!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Reverse Another"
        >
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">{result.pageCount}</div>
              <div className="text-muted-foreground">pages flipped</div>
            </div>
            <div className="text-muted-foreground">
              Page 1 → Page {result.pageCount}<br />
              Page {result.pageCount} → Page 1
            </div>
          </div>
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
              <p className="font-bold text-foreground mb-1">When to use this?</p>
              <p className="text-muted-foreground">
                Useful when you scanned pages in the wrong order, or need to flip reading direction.
              </p>
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

          {pageCount > 0 && (
            <div className="border-2 border-foreground/20 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Page order will be reversed:</p>
              <div className="flex items-center justify-center gap-3 font-mono text-sm">
                <span>1, 2, 3, ... {pageCount}</span>
                <span className="text-muted-foreground">→</span>
                <span>{pageCount}, ... 3, 2, 1</span>
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Reversing..." />}

          <button onClick={handleReverse} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Reversing...</>
            ) : (
              <><ReversePagesIcon className="w-5 h-5" />Reverse Pages</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

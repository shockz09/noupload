"use client";

import { useState, useCallback, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages } from "@/components/pdf/pdf-page-preview";
import { duplicatePages, downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";
import { DuplicateIcon, PdfIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard, PdfFileInfo } from "@/components/pdf/shared";

interface DuplicateResult {
  data: Uint8Array;
  filename: string;
  originalCount: number;
  newCount: number;
}

export default function DuplicatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DuplicateResult | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const processingRef = useRef(false);

  const { pages, loading: pagesLoading } = usePdfPages(file, 0.3);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
      setSelectedPages(new Set());
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setSelectedPages(new Set());
  }, []);

  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPages(new Set(pages.map((p) => p.pageNumber)));
  };

  const selectNone = () => {
    setSelectedPages(new Set());
  };

  const handleDuplicate = async () => {
    if (!file || selectedPages.size === 0 || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(30);
      const pageNumbers = Array.from(selectedPages).sort((a, b) => a - b);
      const data = await duplicatePages(file, pageNumbers);
      setProgress(90);

      const baseName = file.name.replace(/\.pdf$/i, "");
      setResult({
        data,
        filename: `${baseName}_duplicated.pdf`,
        originalCount: pages.length,
        newCount: pages.length + pageNumbers.length,
      });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate pages");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
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
    setSelectedPages(new Set());
  };

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<DuplicateIcon className="w-7 h-7" />}
        iconClass="tool-organize"
        title="Duplicate Pages"
        description="Select pages to duplicate and append to the end"
      />

      {result ? (
        <SuccessCard
          stampText="Duplicated"
          title="Pages Duplicated!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Duplicate More"
        >
          <div className="text-center text-sm text-muted-foreground">
            <span className="font-bold">{result.originalCount}</span> pages → <span className="font-bold">{result.newCount}</span> pages
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
              <p className="font-bold text-foreground mb-1">How it works</p>
              <p className="text-muted-foreground">
                Select pages to duplicate. Copies will be appended to the end of the document.
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

          {pagesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading pages...</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedPages.size} of {pages.length} pages selected
                </p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-sm text-primary font-medium hover:underline">
                    Select All
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={selectNone} className="text-sm text-primary font-medium hover:underline">
                    Select None
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {pages.map((page) => (
                  <button
                    key={page.pageNumber}
                    onClick={() => togglePage(page.pageNumber)}
                    className={`relative aspect-[3/4] border-2 rounded overflow-hidden transition-all ${
                      selectedPages.has(page.pageNumber)
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-foreground/20 hover:border-foreground/40"
                    }`}
                  >
                    <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-contain bg-white" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
                      {page.pageNumber}
                    </div>
                    {selectedPages.has(page.pageNumber) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Duplicating..." />}

          <button
            onClick={handleDuplicate}
            disabled={isProcessing || selectedPages.size === 0}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Duplicating...</>
            ) : (
              <><DuplicateIcon className="w-5 h-5" />Duplicate {selectedPages.size} {selectedPages.size === 1 ? "Page" : "Pages"}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages } from "@/components/pdf/pdf-page-preview";
import { deletePages, downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";
import { DeletePagesIcon, PdfIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard, PdfFileInfo } from "@/components/pdf/shared";

interface DeleteResult {
  data: Uint8Array;
  filename: string;
  originalCount: number;
  deletedCount: number;
}

export default function DeletePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeleteResult | null>(null);
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

  const handleDelete = async () => {
    if (!file || selectedPages.size === 0 || processingRef.current) return;

    if (selectedPages.size === pages.length) {
      setError("Cannot delete all pages");
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(30);
      const pageNumbers = Array.from(selectedPages).sort((a, b) => a - b);
      const data = await deletePages(file, pageNumbers);
      setProgress(90);

      const baseName = file.name.replace(/\.pdf$/i, "");
      setResult({
        data,
        filename: `${baseName}_trimmed.pdf`,
        originalCount: pages.length,
        deletedCount: pageNumbers.length,
      });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pages");
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

  const remainingPages = pages.length - selectedPages.size;

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<DeletePagesIcon className="w-7 h-7" />}
        iconClass="tool-organize"
        title="Delete Pages"
        description="Select pages to remove from your PDF"
      />

      {result ? (
        <SuccessCard
          stampText="Trimmed"
          title="Pages Deleted!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Delete More"
        >
          <div className="text-center text-sm text-muted-foreground">
            Removed <span className="font-bold">{result.deletedCount}</span> pages
            ({result.originalCount} → {result.originalCount - result.deletedCount})
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
                Select pages to delete. At least one page must remain.
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
                  {selectedPages.size} selected to delete · {remainingPages} will remain
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
                        ? "border-red-500 ring-2 ring-red-500/30 opacity-60"
                        : "border-foreground/20 hover:border-foreground/40"
                    }`}
                  >
                    <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-contain bg-white" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
                      {page.pageNumber}
                    </div>
                    {selectedPages.has(page.pageNumber) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                        <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Deleting..." />}

          <button
            onClick={handleDelete}
            disabled={isProcessing || selectedPages.size === 0 || remainingPages === 0}
            className="btn-primary w-full bg-red-600 hover:bg-red-700"
          >
            {isProcessing ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</>
            ) : (
              <><DeletePagesIcon className="w-5 h-5" />Delete {selectedPages.size} {selectedPages.size === 1 ? "Page" : "Pages"}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

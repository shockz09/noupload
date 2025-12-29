"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { FileList } from "@/components/pdf/file-list";
import { mergePDFs, downloadBlob } from "@/lib/pdf-utils";
import { MergeIcon, LoaderIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard } from "@/components/pdf/shared";

interface FileItem {
  file: File;
  id: string;
}

interface MergeResult {
  data: Uint8Array;
  filename: string;
  originalCount: number;
  totalSize: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export default function MergePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MergeResult | null>(null);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const newItems = newFiles.map((file) => ({
      file,
      id: crypto.randomUUID(),
    }));
    setFiles((prev) => [...prev, ...newItems]);
    setError(null);
    setResult(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setResult(null);
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const [moved] = newFiles.splice(fromIndex, 1);
      newFiles.splice(toIndex, 0, moved);
      return newFiles;
    });
    setResult(null);
  }, []);

  const handleClear = useCallback(() => {
    setFiles([]);
    setError(null);
    setResult(null);
  }, []);

  const handleMerge = async () => {
    if (files.length < 2) {
      setError("Please select at least 2 PDF files to merge");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      setProgress(20);
      await new Promise((r) => setTimeout(r, 100));

      setProgress(40);
      const mergedPdf = await mergePDFs(files.map((f) => f.file));

      setProgress(80);
      await new Promise((r) => setTimeout(r, 100));

      const firstName = files[0].file.name.replace(".pdf", "");
      const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

      setResult({
        data: mergedPdf,
        filename: `${firstName}_merged.pdf`,
        originalCount: files.length,
        totalSize,
      });

      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge PDFs");
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
    setFiles([]);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<MergeIcon className="w-7 h-7" />}
        iconClass="tool-merge"
        title="Merge PDF"
        description="Combine multiple PDFs into a single document"
      />

      {result ? (
        <SuccessCard
          stampText="Complete"
          title="PDFs Merged!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Merge More Files"
        >
          <p className="text-muted-foreground">
            {result.originalCount} files combined into one PDF
          </p>
          <div className="inline-flex items-center gap-4 px-5 py-4 bg-muted border-2 border-foreground">
            <div className="pdf-icon-box">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-foreground truncate max-w-[200px]">{result.filename}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(result.data.length)}</p>
            </div>
          </div>
        </SuccessCard>
      ) : (
        // Upload & Process State
        <div className="space-y-6">
          {/* Dropzone */}
          <FileDropzone
            accept=".pdf"
            multiple
            onFilesSelected={handleFilesSelected}
            maxFiles={50}
            title="Drop your PDF files here"
            subtitle="or click to browse"
          />

          {/* File List */}
          <FileList
            files={files}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onClear={handleClear}
          />

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Merging your PDFs..." />}

          {/* Merge Button */}
          <button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Merging...
              </>
            ) : (
              <>
                <MergeIcon className="w-5 h-5" />
                Merge {files.length > 0 ? `${files.length} PDFs` : "PDFs"}
              </>
            )}
          </button>

          {/* Hint */}
          {files.length === 1 && (
            <p className="text-sm text-muted-foreground text-center font-medium">
              Add at least one more PDF to merge
            </p>
          )}
        </div>
      )}
    </div>
  );
}

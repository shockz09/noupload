"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderIcon, MergeIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { FileList } from "@/components/pdf/file-list";
import { ErrorBox, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { useFileProcessing, usePdfDataResult } from "@/hooks";
import { mergePDFs } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface FileItem {
  file: File;
  id: string;
}

interface MergeMetadata {
  originalCount: number;
  totalSize: number;
}

export default function MergePage() {
  const [files, setFiles] = useState<FileItem[]>([]);

  // Use custom hooks
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = usePdfDataResult<MergeMetadata>();

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      const newItems = newFiles.map((file) => ({
        file,
        id: crypto.randomUUID(),
      }));
      setFiles((prev) => [...prev, ...newItems]);
      clearResult();
    },
    [clearResult],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      clearResult();
    },
    [clearResult],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setFiles((prev) => {
        const newFiles = [...prev];
        const [moved] = newFiles.splice(fromIndex, 1);
        newFiles.splice(toIndex, 0, moved);
        return newFiles;
      });
      clearResult();
    },
    [clearResult],
  );

  const handleClear = useCallback(() => {
    setFiles([]);
    clearResult();
  }, [clearResult]);

  const handleMerge = useCallback(async () => {
    if (files.length < 2) {
      setError("Please select at least 2 PDF files to merge");
      return;
    }

    if (!startProcessing()) return;

    try {
      setProgress(20);
      await new Promise((r) => setTimeout(r, 100));

      setProgress(40);
      const mergedPdf = await mergePDFs(files.map((f) => f.file));

      setProgress(80);
      await new Promise((r) => setTimeout(r, 100));

      const firstName = getFileBaseName(files[0].file.name);
      const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

      setResult(mergedPdf, `${firstName}_merged.pdf`, { originalCount: files.length, totalSize });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge PDFs");
    } finally {
      stopProcessing();
    }
  }, [files, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    setFiles([]);
    clearResult();
  }, [clearResult]);

  const buttonLabel = useMemo(() => (files.length > 0 ? `Merge ${files.length} PDFs` : "Merge PDFs"), [files.length]);

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
          <p className="text-muted-foreground">{result.metadata?.originalCount} files combined into one PDF</p>
          <div className="inline-flex items-center gap-4 px-5 py-4 bg-muted border-2 border-foreground">
            <div className="pdf-icon-box">
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
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
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple
            onFilesSelected={handleFilesSelected}
            maxFiles={50}
            title="Drop your PDF files here"
            subtitle="or click to browse"
          />

          <FileList files={files} onRemove={handleRemove} onReorder={handleReorder} onClear={handleClear} />

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Merging your PDFs..." />}

          <button
            type="button"
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
                {buttonLabel}
              </>
            )}
          </button>

          {files.length === 1 && (
            <p className="text-sm text-muted-foreground text-center font-medium">Add at least one more PDF to merge</p>
          )}
        </div>
      )}
    </div>
  );
}

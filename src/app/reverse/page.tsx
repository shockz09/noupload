"use client";

import { useCallback, useState } from "react";
import { PdfIcon, ReversePagesIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, PdfResultView } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getPDFPageCount, reversePDF } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface ReverseResult {
  data: Uint8Array;
  filename: string;
  pageCount: number;
}

export default function ReversePage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReverseResult | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  // Use custom hook for processing state
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        setProgress(30);
        const data = await reversePDF(fileToProcess);
        const count = await getPDFPageCount(fileToProcess);
        setProgress(90);

        const baseName = getFileBaseName(fileToProcess.name);
        setResult({
          data,
          filename: `${baseName}_reversed.pdf`,
          pageCount: count,
        });
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to reverse PDF"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearError();
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
    },
    [isInstant, processFile, clearError],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setResult(null);
    setPageCount(0);
  }, [clearError]);

  const handleReverse = useCallback(async () => {
    if (!file) return;
    processFile(file);
  }, [file, processFile]);

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
    setFile(null);
    setResult(null);
    clearError();
    setPageCount(0);
  }, [clearError]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    const blob = new Blob([new Uint8Array(result.data)], { type: "application/pdf" });
    addToBuffer({
      filename: result.filename,
      blob,
      mimeType: "application/pdf",
      size: blob.size,
      fileType: "pdf",
      sourceToolLabel: "Reverse Pages",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<ReversePagesIcon className="w-7 h-7" />}
        iconClass="tool-reverse"
        title="Reverse Pages"
        description="Flip the order of all pages in your PDF"
      />

      {result ? (
        <PdfResultView
          title="Pages Reversed!"
          subtitle={`${result.pageCount} pages flipped · Page 1 → ${result.pageCount}, Page ${result.pageCount} → 1`}
          data={result.data}
          size={result.data.length}
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Reverse Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          <InfoBox title="When to use this?">
            Useful when you scanned pages in the wrong order, or need to flip reading direction.
          </InfoBox>
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

          <button type="button" onClick={handleReverse} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Reversing...
              </>
            ) : (
              <>
                <ReversePagesIcon className="w-5 h-5" />
                Reverse Pages
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

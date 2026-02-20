"use client";

import { useCallback, useState } from "react";
import { PdfIcon, SanitizeIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getPDFMetadata, sanitizePDF } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface SanitizeResult {
  data: Uint8Array;
  filename: string;
  removedFields: string[];
}

interface Metadata {
  title: string | undefined;
  author: string | undefined;
  subject: string | undefined;
  keywords: string | undefined;
  producer: string | undefined;
  creator: string | undefined;
  creationDate: Date | undefined;
  modificationDate: Date | undefined;
  pageCount: number;
}

export default function SanitizePage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SanitizeResult | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);

  // Use custom hook for processing state
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        setProgress(30);
        const { data, removedFields } = await sanitizePDF(fileToProcess);
        setProgress(90);

        const baseName = getFileBaseName(fileToProcess.name);
        setResult({
          data,
          filename: `${baseName}_sanitized.pdf`,
          removedFields,
        });
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to sanitize PDF"));
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

        // Load metadata to show what will be removed
        try {
          const meta = await getPDFMetadata(selectedFile);
          setMetadata(meta);
        } catch {
          setMetadata(null);
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
    setMetadata(null);
  }, [clearError]);

  const handleSanitize = useCallback(async () => {
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
    setMetadata(null);
  }, [clearError]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<SanitizeIcon className="w-7 h-7" />}
        iconClass="tool-sanitize"
        title="Sanitize PDF"
        description="Remove metadata, author info, and hidden data"
      />

      {result ? (
        <SuccessCard
          stampText="Cleaned"
          title="PDF Sanitized!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Sanitize Another"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Removed {result.removedFields.length} metadata {result.removedFields.length === 1 ? "field" : "fields"}
            </p>
            {result.removedFields.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.removedFields.map((field) => (
                  <span key={field} className="px-2 py-1 bg-muted text-xs font-medium rounded">
                    {field}
                  </span>
                ))}
              </div>
            )}
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

          <InfoBox title="What gets removed?">
            Title, author, subject, keywords, creator, producer, creation date, and modification date.
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

          {metadata && (
            <div className="border-2 border-foreground/20 p-4 space-y-3">
              <p className="font-bold text-sm">Current Metadata</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {metadata.title && (
                  <div className="break-words">
                    <span className="text-muted-foreground">Title:</span> {metadata.title}
                  </div>
                )}
                {metadata.author && (
                  <div className="break-words">
                    <span className="text-muted-foreground">Author:</span> {metadata.author}
                  </div>
                )}
                {metadata.creator && (
                  <div className="break-words">
                    <span className="text-muted-foreground">Creator:</span> {metadata.creator}
                  </div>
                )}
                {metadata.producer && (
                  <div className="break-all">
                    <span className="text-muted-foreground">Producer:</span> {metadata.producer}
                  </div>
                )}
                {metadata.subject && (
                  <div className="break-words">
                    <span className="text-muted-foreground">Subject:</span> {metadata.subject}
                  </div>
                )}
                {metadata.creationDate && (
                  <div>
                    <span className="text-muted-foreground">Created:</span> {metadata.creationDate.toLocaleDateString()}
                  </div>
                )}
                {!metadata.title &&
                  !metadata.author &&
                  !metadata.creator &&
                  !metadata.producer &&
                  !metadata.subject &&
                  !metadata.creationDate && <div className="col-span-2 text-muted-foreground">No metadata found</div>}
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Sanitizing..." />}

          <button type="button" onClick={handleSanitize} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sanitizing...
              </>
            ) : (
              <>
                <SanitizeIcon className="w-5 h-5" />
                Remove Metadata
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

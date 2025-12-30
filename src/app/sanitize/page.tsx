"use client";

import { useState, useCallback, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { sanitizePDF, getPDFMetadata, downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";
import { SanitizeIcon, PdfIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard, PdfFileInfo } from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SanitizeResult | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
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
      const { data, removedFields } = await sanitizePDF(fileToProcess);
      setProgress(90);

      const baseName = fileToProcess.name.replace(/\.pdf$/i, "");
      setResult({
        data,
        filename: `${baseName}_sanitized.pdf`,
        removedFields,
      });
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sanitize PDF");
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
  }, [isInstant, processFile]);

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setMetadata(null);
  }, []);

  const handleSanitize = async () => {
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
    setMetadata(null);
  };

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<SanitizeIcon className="w-7 h-7" />}
        iconClass="tool-security"
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

          <div className="info-box">
            <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">What gets removed?</p>
              <p className="text-muted-foreground">
                Title, author, subject, keywords, creator, producer, creation date, and modification date.
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

          {metadata && (
            <div className="border-2 border-foreground/20 p-4 space-y-3">
              <p className="font-bold text-sm">Current Metadata</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {metadata.title && <div><span className="text-muted-foreground">Title:</span> {metadata.title}</div>}
                {metadata.author && <div><span className="text-muted-foreground">Author:</span> {metadata.author}</div>}
                {metadata.creator && <div><span className="text-muted-foreground">Creator:</span> {metadata.creator}</div>}
                {metadata.producer && <div><span className="text-muted-foreground">Producer:</span> {metadata.producer}</div>}
                {metadata.subject && <div><span className="text-muted-foreground">Subject:</span> {metadata.subject}</div>}
                {metadata.creationDate && <div><span className="text-muted-foreground">Created:</span> {metadata.creationDate.toLocaleDateString()}</div>}
                {!metadata.title && !metadata.author && !metadata.creator && !metadata.producer && !metadata.subject && !metadata.creationDate && (
                  <div className="col-span-2 text-muted-foreground">No metadata found</div>
                )}
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Sanitizing..." />}

          <button onClick={handleSanitize} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sanitizing...</>
            ) : (
              <><SanitizeIcon className="w-5 h-5" />Remove Metadata</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

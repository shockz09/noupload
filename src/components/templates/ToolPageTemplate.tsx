"use client";

import type React from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";

export interface ToolPageTemplateProps<T> {
  // Page metadata
  title: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;

  // File handling
  accept: string;
  processFile: (file: File, onProgress?: (progress: number) => void) => Promise<T>;

  // Success rendering
  renderSuccessContent?: (result: T) => React.ReactNode;
  successStamp: string;
  successTitle: string;
  downloadLabel: string;
  startOverLabel: string;

  // Info box
  infoBoxTitle: string;
  infoBoxContent: React.ReactNode;
  instantInfoBoxContent?: React.ReactNode;

  // Optional: Custom processing UI (if not provided, shows simple button)
  renderProcessingUI?: (props: {
    file: File;
    onProcess: () => void;
    isProcessing: boolean;
    error: string | null;
  }) => React.ReactNode;

  // Optional: File info display
  getFileSizeDisplay?: (file: File) => string;

  // Optional: Multiple files support
  multiple?: boolean;
  maxFiles?: number;

  // Page wrapper class
  className?: string;
}

export const ToolPageTemplate = memo(function ToolPageTemplate<T extends { data: Uint8Array | Blob; filename: string }>(
  props: ToolPageTemplateProps<T>,
) {
  const {
    title,
    description,
    icon,
    iconClass,
    accept,
    processFile,
    renderSuccessContent,
    successStamp,
    successTitle,
    downloadLabel,
    startOverLabel,
    infoBoxTitle,
    infoBoxContent,
    instantInfoBoxContent,
    renderProcessingUI,
    getFileSizeDisplay = (file) => formatFileSize(file.size),
    multiple = false,
    maxFiles,
    className = "max-w-2xl mx-auto",
  } = props;

  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const instantTriggeredRef = useRef(false);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const handleProcess = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        const processed = await processFile(fileToProcess, setProgress);
        setResult(processed);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to process file"));
      } finally {
        stopProcessing();
      }
    },
    [processFile, startProcessing, setError, stopProcessing, setProgress],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        setFile(files[0]);
        clearError();
        setResult(null);
        instantTriggeredRef.current = false;
      }
    },
    [clearError],
  );

  // Instant mode auto-process
  useEffect(() => {
    if (isInstant && file && !instantTriggeredRef.current && !isProcessing && !result) {
      instantTriggeredRef.current = true;
      handleProcess(file);
    }
  }, [isInstant, file, isProcessing, result, handleProcess]);

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setResult(null);
  }, [clearError]);

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
    instantTriggeredRef.current = false;
  }, [clearError]);

  if (!isLoaded) return null;

  return (
    <div className={`page-enter space-y-8 ${className}`}>
      <PdfPageHeader icon={icon} iconClass={iconClass} title={title} description={description} />

      {result ? (
        <SuccessCard
          stampText={successStamp}
          title={successTitle}
          downloadLabel={downloadLabel}
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel={startOverLabel}
        >
          {renderSuccessContent?.(result)}
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={accept}
            multiple={multiple}
            maxFiles={maxFiles}
            onFilesSelected={handleFileSelected}
            title="Drop your file here"
          />

          <InfoBox title={isInstant && instantInfoBoxContent ? infoBoxTitle : infoBoxTitle}>
            {isInstant && instantInfoBoxContent ? instantInfoBoxContent : infoBoxContent}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo file={file} fileSize={getFileSizeDisplay(file)} onClear={handleClear} icon={icon} />

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} />}

          {renderProcessingUI ? (
            renderProcessingUI({
              file,
              onProcess: () => handleProcess(file),
              isProcessing,
              error,
            })
          ) : (
            <button
              type="button"
              onClick={() => handleProcess(file)}
              disabled={isProcessing}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {icon}
                  Process
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}) as <T extends { data: Uint8Array | Blob; filename: string }>(props: ToolPageTemplateProps<T>) => React.ReactElement;

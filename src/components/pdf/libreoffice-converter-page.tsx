import { useCallback, useState } from "react";
import { PdfIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfPageHeader, PdfResultView, ProcessButton, ProgressBar } from "@/components/pdf/shared";
import { FileInfo, InfoBox } from "@/components/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { useLibreOffice } from "@/lib/libreoffice";
import { formatFileSize } from "@/lib/utils";

interface LibreOfficeConverterPageProps {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  accept: string;
  dropzoneTitle: string;
  dropzoneSubtitle: string;
  fileIcon: React.ReactNode;
  buttonIcon?: React.ReactNode;
  buttonLabel: string;
  sourceToolLabel: string;
  infoBoxContent: React.ReactNode;
}

interface ConvertResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  newSize: number;
  processingTimeSeconds: number;
}

export function LibreOfficeConverterPage({
  icon,
  iconClass,
  title,
  description,
  accept,
  dropzoneTitle,
  dropzoneSubtitle,
  fileIcon,
  buttonIcon,
  buttonLabel,
  sourceToolLabel,
  infoBoxContent,
}: LibreOfficeConverterPageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { isReady, error: engineError, convert } = useLibreOffice();

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
    }
  }, []);

  const handleConvert = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const { blob, processingTimeSeconds } = await convert(file);

      setResult({
        blob,
        filename: file.name.replace(/\.[^.]+$/, ".pdf"),
        originalSize: file.size,
        newSize: blob.size,
        processingTimeSeconds,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Conversion failed"));
    } finally {
      stopProcessing();
    }
  }, [file, convert, startProcessing, stopProcessing, setError]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) {
        downloadBlob(result.blob, result.filename);
      }
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
  }, []);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "application/pdf",
      size: result.blob.size,
      fileType: "pdf",
      sourceToolLabel,
    });
  }, [result, addToBuffer, sourceToolLabel]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader icon={icon} iconClass={iconClass} title={title} description={description} />

      {engineError && <ErrorBox message={engineError} />}

      {result ? (
        <PdfResultView
          title="PDF Ready"
          subtitle={`${formatFileSize(result.originalSize)} → ${formatFileSize(result.newSize)} · ${result.processingTimeSeconds.toFixed(1)}s`}
          data={result.blob}
          size={result.newSize}
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        />
      ) : (
        <div className="space-y-6">
          {!file ? (
            <FileDropzone
              accept={accept}
              multiple={false}
              onFilesSelected={handleFilesSelected}
              title={dropzoneTitle}
              subtitle={dropzoneSubtitle}
            />
          ) : (
            <>
              <FileInfo
                file={file}
                fileSize={formatFileSize(file.size)}
                onClear={handleStartOver}
                icon={fileIcon}
              />

              {isProcessing ? (
                <ProgressBar progress={-1} label="Converting with LibreOffice..." />
              ) : (
                <ProcessButton
                  onClick={handleConvert}
                  disabled={!isReady || isProcessing}
                  isProcessing={isProcessing}
                  processingLabel="Converting..."
                  icon={buttonIcon || <PdfIcon className="w-5 h-5" />}
                  label={isReady ? buttonLabel : "Loading engine (~53MB, cached after)..."}
                />
              )}
            </>
          )}

          {error && <ErrorBox message={error} />}
        </div>
      )}

      <InfoBox title="LibreOffice-quality conversion">{infoBoxContent}</InfoBox>
    </div>
  );
}

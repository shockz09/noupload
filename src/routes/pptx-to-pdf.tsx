import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pptx-to-pdf")({
	head: () => ({
		meta: [
			{ title: "PPTX to PDF Converter Free - Convert PowerPoint to PDF | noupload" },
			{ name: "description", content: "Convert PowerPoint presentations to PDF for free. Supports PPTX, PPT, ODP, PPTM. LibreOffice-quality rendering runs 100% in your browser." },
			{ name: "keywords", content: "pptx to pdf, powerpoint to pdf, convert pptx, ppt to pdf, presentation to pdf, odp to pdf, free pptx converter, offline pptx to pdf" },
			{ property: "og:title", content: "PPTX to PDF Converter Free - Convert PowerPoint to PDF" },
			{ property: "og:description", content: "Convert PowerPoint presentations to PDF for free. LibreOffice-quality rendering, works 100% offline in your browser." },
		],
	}),
	component: PptxToPdfPage,
});

import { useCallback, useState } from "react";
import { PdfIcon, PptxIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfPageHeader, PdfResultView, ProcessButton, ProgressBar } from "@/components/pdf/shared";
import { FileInfo, InfoBox } from "@/components/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { useLibreOffice } from "@/lib/libreoffice";
import { formatFileSize } from "@/lib/utils";

interface ConvertResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  newSize: number;
  processingTimeSeconds: number;
}

function PptxToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();

  const { isReady, isLoading, status: engineStatus, error: engineError, convert } = useLibreOffice();

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
      sourceToolLabel: "PPTX to PDF",
    });
  }, [result, addToBuffer]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<PptxIcon className="w-7 h-7" />}
        iconClass="tool-pptx-to-pdf"
        title="PPTX to PDF"
        description="Convert PowerPoint presentations to PDF with LibreOffice-quality rendering"
      />

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
              accept=".pptx,.ppt,.odp,.pptm"
              multiple={false}
              onFilesSelected={handleFilesSelected}
              title="Drop your presentation here"
              subtitle="Supports PPTX, PPT, ODP, PPTM"
            />
          ) : (
            <>
              <FileInfo
                file={file}
                fileSize={formatFileSize(file.size)}
                onClear={handleStartOver}
                icon={<PptxIcon className="w-5 h-5" />}
              />

              {isProcessing ? (
                <ProgressBar progress={-1} label="Converting with LibreOffice..." />
              ) : (
                <ProcessButton
                  onClick={handleConvert}
                  disabled={!isReady || isProcessing}
                  isProcessing={isProcessing}
                  processingLabel="Converting..."
                  icon={<PdfIcon className="w-5 h-5" />}
                  label={isReady ? "Convert to PDF" : "Waiting for engine..."}
                />
              )}
            </>
          )}

          {error && <ErrorBox message={error} />}
        </div>
      )}

      <InfoBox title="LibreOffice-quality conversion">
        Powered by LibreOffice WASM — the same rendering engine used by desktop LibreOffice. Handles charts, SmartArt,
        custom fonts, and complex layouts faithfully. First use downloads ~53MB engine (cached after). Everything runs
        in your browser — your files never leave your device.
      </InfoBox>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { DownloadIcon, PdfIcon, TextIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { downloadText } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { loadPdfjs } from "@/lib/pdfjs-config";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface ExtractResult {
  text: string;
  filename: string;
  pageCount: number;
  wordCount: number;
}

async function extractTextFromPDF(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await loadPdfjs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ("str" in item ? (item as { str: string }).str : "")).join(" ");
    textParts.push(`--- Page ${i} ---\n${pageText}`);
  }

  return {
    text: textParts.join("\n\n"),
    pageCount: totalPages,
  };
}

export default function PdfToTextPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  // Use custom hook for processing state
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        setProgress(30);
        const { text, pageCount } = await extractTextFromPDF(fileToProcess);
        setProgress(90);

        const baseName = getFileBaseName(fileToProcess.name);
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        setResult({
          text,
          filename: `${baseName}.txt`,
          pageCount,
          wordCount,
        });
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to extract text"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearError();
        setResult(null);

        if (isInstant) {
          processFile(selectedFile);
        }
      }
    },
    [isInstant, processFile, clearError],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setResult(null);
  }, [clearError]);

  const handleExtract = useCallback(async () => {
    if (!file) return;
    processFile(file);
  }, [file, processFile]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) {
        downloadText(result.text, result.filename);
      }
    },
    [result],
  );

  const handleCopy = useCallback(async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result.text);
      } catch {
        setError("Failed to copy to clipboard");
      }
    }
  }, [result]);

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    clearError();
  }, [clearError]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<TextIcon className="w-7 h-7" />}
        iconClass="tool-convert"
        title="PDF to Text"
        description="Extract all text content from your PDF"
      />

      {result ? (
        <div className="space-y-6">
          <div className="card-base p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-lg">Text Extracted!</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary text-sm px-3 py-1.5 flex-1 sm:flex-none"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="btn-primary text-sm px-3 py-1.5 flex-1 sm:flex-none"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download .txt
                </button>
              </div>
            </div>

            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{result.pageCount} pages</span>
              <span>{result.wordCount.toLocaleString()} words</span>
              <span>{result.text.length.toLocaleString()} characters</span>
            </div>

            <div className="border-2 border-foreground/20 p-4 max-h-96 overflow-y-auto bg-muted/30">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {result.text.slice(0, 5000)}
                {result.text.length > 5000 && "\n\n... (truncated preview, download for full text)"}
              </pre>
            </div>
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Extract Another PDF
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          <InfoBox title="How it works">
            Extracts all selectable text from your PDF. Note: scanned documents without OCR will have no text.
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

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Extracting text..." />}

          <button type="button" onClick={handleExtract} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <TextIcon className="w-5 h-5" />
                Extract Text
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

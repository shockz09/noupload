"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { PdfIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { PDFA_DESCRIPTIONS, type PdfALevel, useGhostscript } from "@/lib/ghostscript/useGhostscript";
import { downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

// Archive icon
const ArchiveIcon = memo(function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
});

interface ConvertResult {
  data: Uint8Array;
  filename: string;
  originalSize: number;
  newSize: number;
  level: PdfALevel;
}

export default function PdfToPdfAPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const { toPdfA, progress: gsProgress } = useGhostscript();
  const [file, setFile] = useState<File | null>(null);
  const [pdfaLevel, setPdfaLevel] = useState<PdfALevel>("1b");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const instantTriggeredRef = useRef(false);

  // Use custom hook for processing state
  const { isProcessing, error, startProcessing, stopProcessing, setError, clearError } = useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File, level: PdfALevel = "1b") => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        const converted = await toPdfA(fileToProcess, level);

        const baseName = getFileBaseName(fileToProcess.name);
        setResult({
          data: converted,
          filename: `${baseName}_pdfa-${level}.pdf`,
          originalSize: fileToProcess.size,
          newSize: converted.length,
          level,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to convert PDF");
      } finally {
        stopProcessing();
      }
    },
    [toPdfA, startProcessing, setError, stopProcessing],
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
      processFile(file, pdfaLevel);
    }
  }, [isInstant, file, isProcessing, result, processFile, pdfaLevel]);

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setResult(null);
  }, [clearError]);

  const handleConvert = useCallback(async () => {
    if (!file) return;
    processFile(file, pdfaLevel);
  }, [file, pdfaLevel, processFile]);

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

  // Level selection handler
  const handleLevelSelect = useCallback((level: PdfALevel) => {
    setPdfaLevel(level);
  }, []);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<ArchiveIcon className="w-7 h-7" />}
        iconClass="tool-pdfa"
        title="PDF to PDF/A"
        description="Convert to archival format for long-term preservation"
      />

      {result ? (
        <SuccessCard
          stampText={`PDF/A-${result.level}`}
          title="Converted to PDF/A!"
          downloadLabel="Download PDF/A"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        >
          <div className="text-center text-sm text-muted-foreground">
            <p>
              {formatFileSize(result.originalSize)} → {formatFileSize(result.newSize)}
            </p>
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

          {/* PDF/A Level Selector */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">PDF/A Conformance Level</legend>
            <div className="grid grid-cols-3 gap-3" role="group">
              {(["1b", "2b", "3b"] as PdfALevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleLevelSelect(level)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    pdfaLevel === level
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="font-medium text-sm">PDF/A-{level}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {level === "1b" && "Most compatible"}
                    {level === "2b" && "Transparency"}
                    {level === "3b" && "Attachments"}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{PDFA_DESCRIPTIONS[pdfaLevel]}</p>
          </fieldset>

          <div className="info-box">
            <svg
              aria-hidden="true"
              className="w-5 h-5 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">{isInstant ? "Instant conversion" : "About PDF/A"}</p>
              <p className="text-muted-foreground">
                {isInstant
                  ? "Drop a PDF and it will be converted automatically."
                  : "PDF/A is an ISO standard for long-term archiving. Required by many government and legal systems."}
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

          {/* PDF/A Level Selector (when file selected) */}
          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">PDF/A Conformance Level</legend>
              <div className="grid grid-cols-3 gap-3" role="group">
                {(["1b", "2b", "3b"] as PdfALevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleLevelSelect(level)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      pdfaLevel === level
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="font-medium text-sm">PDF/A-{level}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {level === "1b" && "Most compatible"}
                      {level === "2b" && "Transparency"}
                      {level === "3b" && "Attachments"}
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={-1} label={gsProgress || "Processing..."} />}

          <button type="button" onClick={handleConvert} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {gsProgress || "Converting..."}
              </>
            ) : (
              <>
                <ArchiveIcon className="w-5 h-5" />
                Convert to PDF/A-{pdfaLevel}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

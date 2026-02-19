"use client";

import { useCallback, useState } from "react";
import { CompressIcon, PdfIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ComparisonDisplay,
  ErrorBox,
  PdfFileInfo,
  PdfPageHeader,
  ProgressBar,
  SavingsBadge,
  SuccessCard,
} from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { COMPRESSION_DESCRIPTIONS, type CompressionLevel, useGhostscript } from "@/lib/ghostscript/useGhostscript";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface CompressResult {
  data: Uint8Array;
  filename: string;
  originalSize: number;
  compressedSize: number;
}

export default function CompressPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const { compress: gsCompress, progress: gsProgress } = useGhostscript();
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("balanced");
  const [result, setResult] = useState<CompressResult | null>(null);

  // Use custom hook for processing state
  const { isProcessing, error, startProcessing, stopProcessing, setError, clearError } = useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File, level: CompressionLevel = "balanced") => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        const compressed = await gsCompress(fileToProcess, level);

        const baseName = getFileBaseName(fileToProcess.name);
        setResult({
          data: compressed,
          filename: `${baseName}_compressed.pdf`,
          originalSize: fileToProcess.size,
          compressedSize: compressed.length,
        });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to compress PDF"));
      } finally {
        stopProcessing();
      }
    },
    [gsCompress, startProcessing, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        setFile(files[0]);
        clearError();
        setResult(null);

        if (isInstant) {
          processFile(files[0], compressionLevel);
        }
      }
    },
    [isInstant, processFile, compressionLevel, clearError],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setResult(null);
  }, [clearError]);

  const handleCompress = useCallback(async () => {
    if (!file) return;
    processFile(file, compressionLevel);
  }, [file, compressionLevel, processFile]);

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
  }, [clearError]);

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<CompressIcon className="w-7 h-7" />}
        iconClass="tool-compress"
        title="Compress PDF"
        description="Reduce file size while preserving quality"
      />

      {result ? (
        <SuccessCard
          stampText="Optimized"
          title="PDF Compressed!"
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={formatFileSize(result.originalSize)}
            newLabel="Compressed"
            newValue={formatFileSize(result.compressedSize)}
          />
          <SavingsBadge savings={savings} />
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          {/* Compression Level Selector */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Compression Level</legend>
            <div className="grid grid-cols-3 gap-3" role="group">
              {(["light", "balanced", "maximum"] as CompressionLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCompressionLevel(level)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    compressionLevel === level
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="font-medium capitalize text-sm">{level}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {level === "light" && "Best quality"}
                    {level === "balanced" && "Recommended"}
                    {level === "maximum" && "Smallest size"}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{COMPRESSION_DESCRIPTIONS[compressionLevel]}</p>
          </fieldset>

          <InfoBox title={isInstant ? "Instant compression" : "About compression"}>
            {isInstant
              ? "Drop a PDF and it will be compressed automatically."
              : "Recompresses images for major file size reduction. First use may take longer to load."}
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

          {/* Compression Level Selector (when file selected) */}
          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Compression Level</legend>
              <div className="grid grid-cols-3 gap-3" role="group">
                {(["light", "balanced", "maximum"] as CompressionLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCompressionLevel(level)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      compressionLevel === level
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="font-medium capitalize text-sm">{level}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {level === "light" && "Best quality"}
                      {level === "balanced" && "Recommended"}
                      {level === "maximum" && "Smallest size"}
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={-1} label={gsProgress || "Processing..."} />}

          <button type="button" onClick={handleCompress} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {gsProgress || "Compressing..."}
              </>
            ) : (
              <>
                <CompressIcon className="w-5 h-5" />
                Compress PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

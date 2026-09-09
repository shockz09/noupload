import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/compress")({
	head: () => ({
		meta: [
			{ title: "Compress PDF Online Free - Reduce PDF File Size | noupload" },
			{ name: "description", content: "Reduce PDF file size for free. Choose compression level, see size reduction instantly. Works offline, your files stay private." },
			{ name: "keywords", content: "compress pdf, reduce pdf size, pdf compressor, shrink pdf, free pdf compression, optimize pdf" },
			{ property: "og:title", content: "Compress PDF Online Free - Reduce PDF File Size" },
			{ property: "og:description", content: "Reduce PDF file size for free. Works 100% offline, your files stay private." },
		],
	}),
	component: CompressPage,
});

import { useCallback, useState } from "react";
import { CompressIcon, PdfIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ErrorBox,
  PdfFileInfo,
  PdfPageHeader,
  PdfResultView,
} from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { COMPRESSION_DESCRIPTIONS, type CompressionLevel, useGhostscript } from "@/lib/ghostscript/useGhostscript";
import { formatCompressionResult, formatFileSize, getFileBaseName } from "@/lib/utils";

interface CompressResult {
  data: Uint8Array;
  filename: string;
  originalSize: number;
  compressedSize: number;
  /** True when Ghostscript's output was no smaller, so the original bytes were kept. */
  keptOriginal: boolean;
}

function CompressPage() {
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

        // A PDF with no images, or one already optimized, comes back bigger than
        // it went in — Ghostscript rewrites every object either way. Hand back
        // the original in that case instead of an inflated "compressed" file.
        const keptOriginal = compressed.length >= fileToProcess.size;
        const data = keptOriginal ? new Uint8Array(await fileToProcess.arrayBuffer()) : compressed;

        const baseName = getFileBaseName(fileToProcess.name);
        setResult({
          data,
          filename: keptOriginal ? fileToProcess.name : `${baseName}_compressed.pdf`,
          originalSize: fileToProcess.size,
          compressedSize: data.length,
          keptOriginal,
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

      }
    },
    [clearError],
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
      sourceToolLabel: "Compress PDF",
    });
  }, [result, addToBuffer]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<CompressIcon className="w-7 h-7" />}
        iconClass="tool-compress"
        title="Compress PDF"
        description="Reduce file size while preserving quality"
      />

      {result ? (
        <PdfResultView
          title={result.keptOriginal ? "Already As Small As It Gets" : "PDF Compressed!"}
          subtitle={formatCompressionResult(result.originalSize, result.compressedSize, result.keptOriginal)}
          data={result.data}
          size={result.compressedSize}
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        />
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

          <InfoBox title="About compression">
            Recompresses images for major file size reduction. First use may take longer to load.
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

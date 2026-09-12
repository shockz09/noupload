import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/compress")({
  head: () => ({
    meta: [
      { title: "Compress PDF Online Free - Reduce PDF File Size | noupload" },
      {
        name: "description",
        content:
          "Reduce PDF file size for free. Choose compression level, see size reduction instantly. Works offline, your files stay private.",
      },
      {
        name: "keywords",
        content: "compress pdf, reduce pdf size, pdf compressor, shrink pdf, free pdf compression, optimize pdf",
      },
      { property: "og:title", content: "Compress PDF Online Free - Reduce PDF File Size" },
      {
        property: "og:description",
        content: "Reduce PDF file size for free. Works 100% offline, your files stay private.",
      },
    ],
  }),
  component: CompressPage,
});

import { useCallback, useMemo, useState } from "react";
import { CompressIcon, PdfIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, PdfResultView } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { GOOD_ENOUGH_SAVINGS, MOZJPEG_QUALITY } from "@/lib/ghostscript/types";
import { COMPRESSION_DESCRIPTIONS, type CompressionLevel, useGhostscript } from "@/lib/ghostscript/useGhostscript";
import { mupdfLosslessShrink } from "@/lib/mupdf/lossless";
import { probeDocument, recompressImages } from "@/lib/pdf/recompress-images";
import { losslessShrink } from "@/lib/qpdf/lossless";
import { formatFileSize, formatSizeDelta, getFileBaseName } from "@/lib/utils";

const LEVELS: CompressionLevel[] = ["light", "balanced", "maximum"];

/** Below this, it is worth spending a slow extra engine on the file. */
const DISAPPOINTING_SAVINGS = 0.15;

/**
 * Routing thresholds, all read off the document profile.
 *
 * The image share one is the load-bearing rule: measured across 35 real PDFs, it
 * predicted which family of engine would win on every readable file. Below it,
 * Ghostscript reliably *inflates* the document and only the lossless engines
 * help; above it, the lossless engines are never close.
 */
const IMAGE_HEAVY_SHARE = 0.2;
/** Below this share of MozJPEG-encodable images, its route cannot carry the file. */
const MOZJPEG_COVERAGE = 0.7;
/** Above this share of embedded fonts, MuPDF's subsetting beats qpdf's repack. */
const FONT_HEAVY_SHARE = 0.1;

/**
 * The MozJPEG route holds a Ghostscript heap, a parsed copy of the document and
 * a decoded bitmap at once. That is fine on a laptop and is exactly what gets a
 * tab killed on a 2GB phone, so below 4GB of reported RAM only the leaner
 * Ghostscript path runs, and big files stay off it on mid-range devices too.
 */
function canAffordImagePass(fileSize: number): boolean {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (deviceMemory === undefined) return fileSize <= 60 * 1024 * 1024;
  if (deviceMemory < 4) return false;
  if (deviceMemory < 8) return fileSize <= 25 * 1024 * 1024;
  return true;
}

/** How the winning output was produced, for the result line. */
type CompressMethod = "images" | "lossless" | "none";

interface CompressResult {
  data: Uint8Array;
  filename: string;
  originalSize: number;
  compressedSize: number;
  /** Level actually used, which may differ from the selector after a retry. */
  level: CompressionLevel;
  method: CompressMethod;
  /**
   * Whether a harder level could change anything. Only the image passes vary by
   * level, so on a text document every level produces the identical file and
   * offering to "squeeze harder" would be a lie.
   */
  levelMatters: boolean;
  pageCount?: number;
}

/** Turns the worker's sentinel errors into something a user can act on. */
function compressErrorMessage(err: unknown): string {
  const message = getErrorMessage(err, "Failed to compress PDF");
  if (message.includes("PASSWORD_PROTECTED")) {
    return "This PDF is password protected. Remove the password with the Decrypt PDF tool first, then compress it.";
  }
  if (message.includes("NO_PAGES")) {
    return "This PDF could not be read — it may be damaged or empty.";
  }
  return message;
}

function nextLevel(level: CompressionLevel): CompressionLevel | null {
  const i = LEVELS.indexOf(level);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}

function resultTitle(result: CompressResult): string {
  const saved = 1 - result.compressedSize / Math.max(result.originalSize, 1);
  if (saved >= 0.05) return "PDF Compressed!";
  if (saved > 0) return "Squeezed a Little Out";
  return "No Safe Reduction Left";
}

function resultSubtitle(result: CompressResult): string {
  if (result.method === "none") {
    // Say why, rather than just "no". A text document has no images to shrink,
    // and every engine here has already had its turn at the structure.
    const reason = result.levelMatters
      ? "every engine came out bigger than the original"
      : "it is text and fonts, with no images to shrink, and already packed tight";
    return `${formatFileSize(result.originalSize)} · ${reason}, so your original is untouched`;
  }
  const delta = formatSizeDelta(result.originalSize, result.compressedSize);
  return result.method === "lossless" ? `${delta} · lossless repack, image quality untouched` : delta;
}

/** Each returns null rather than throwing: a failed engine must not lose the others. */
async function runQpdf(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    return await losslessShrink(bytes);
  } catch (error) {
    console.warn("[compress] qpdf pass failed:", error);
    return null;
  }
}

async function runMupdf(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    return await mupdfLosslessShrink(bytes);
  } catch (error) {
    console.warn("[compress] MuPDF pass failed:", error);
    return null;
  }
}

function CompressPage() {
  const { compress: gsCompress, progress: gsProgress, release: releaseGhostscript } = useGhostscript();
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("balanced");
  const [result, setResult] = useState<CompressResult | null>(null);
  const [stageMessage, setStageMessage] = useState("");

  // Use custom hook for processing state
  const { isProcessing, error, startProcessing, stopProcessing, setError, clearError } = useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File, level: CompressionLevel = "balanced") => {
      if (!startProcessing()) return;
      setResult(null);
      clearError();
      setStageMessage("");

      try {
        const original = new Uint8Array(await fileToProcess.arrayBuffer());

        let data: Uint8Array<ArrayBuffer> = original;
        let method: CompressMethod = "none";
        const keepIfSmaller = (candidate: Uint8Array | null, as: CompressMethod, engine: string = as) => {
          if (candidate) {
            console.debug(
              `[compress] ${engine}: ${candidate.length} bytes (${(100 - (100 * candidate.length) / original.length).toFixed(1)}% vs original)`,
            );
          }
          if (candidate && candidate.length < data.length) {
            data = new Uint8Array(candidate);
            method = as;
          }
        };

        const savingsSoFar = () => 1 - data.length / Math.max(original.length, 1);

        // One parse decides the route. Engines still run one at a time — each is
        // a WASM heap of a few hundred megabytes — but now only the ones whose
        // result can plausibly win get to run at all.
        const profile = await probeDocument(original).catch(() => null);
        if (profile?.encrypted) throw new Error("PASSWORD_PROTECTED");

        const imageHeavy = profile ? profile.imageShare >= IMAGE_HEAVY_SHARE : true;
        const fontHeavy = (profile?.fontShare ?? 0) >= FONT_HEAVY_SHARE;
        const mozjpegCanCarry = (profile?.compatibleShare ?? 1) >= MOZJPEG_COVERAGE;

        let gsFailure: unknown = null;

        if (imageHeavy) {
          // Preferred route: Ghostscript downsamples but stores photos
          // losslessly, then MozJPEG does the single lossy pass — same image
          // quality as Ghostscript's own encoder in 10-20% fewer bytes.
          // It only pays off if MozJPEG can handle most of the images: a CMYK
          // magazine would leave them all as Flate, so that goes straight to
          // Ghostscript instead of paying for a pass that cannot finish the job.
          let mozjpegCovered = false;

          if (mozjpegCanCarry && canAffordImagePass(fileToProcess.size)) {
            try {
              const flate = await gsCompress(fileToProcess, level, "flate");
              const recompressed = await recompressImages(flate, MOZJPEG_QUALITY[level], setStageMessage);
              keepIfSmaller(recompressed.data, "images", "mozjpeg");
              mozjpegCovered = recompressed.total > 0 && recompressed.converted === recompressed.total;
            } catch (mozjpegError) {
              console.warn("[compress] MozJPEG route failed:", mozjpegError);
            }
          }

          // Ghostscript's own JPEG encoding: the route for images MozJPEG cannot
          // take, and the one carrying the harder second pass when a file has
          // not given up enough yet.
          if (!mozjpegCovered || savingsSoFar() < GOOD_ENOUGH_SAVINGS[level]) {
            try {
              keepIfSmaller(await gsCompress(fileToProcess, level), "images", "ghostscript");
            } catch (gsError) {
              gsFailure = gsError;
            }
          }

          releaseGhostscript();
        }

        // Lossless engines. For a text or font-heavy document they are the whole
        // answer — Ghostscript is skipped there entirely, because rewriting a
        // 600-page book's objects costs 20 seconds to hand back a *larger* file.
        // After a lossy route they only run if it disappointed.
        if (savingsSoFar() < DISAPPOINTING_SAVINGS) {
          // MuPDF subsets embedded fonts, so it wins exactly where fonts are the
          // bulk; qpdf wins on everything else and is a tenth of the download.
          const order = fontHeavy ? [runMupdf, runQpdf] : [runQpdf, runMupdf];
          for (const run of order) {
            keepIfSmaller(await run(original), "lossless", run === runMupdf ? "mupdf" : "qpdf");
            if (savingsSoFar() >= DISAPPOINTING_SAVINGS) break;
          }
        }

        // Safety net: if the routing was wrong about a file, the engine it
        // skipped still gets its turn rather than the user getting nothing.
        if (method === "none" && !imageHeavy) {
          try {
            keepIfSmaller(await gsCompress(fileToProcess, level), "images");
          } catch (gsError) {
            gsFailure = gsError;
          }
          releaseGhostscript();
        }

        if (method === "none" && gsFailure) throw gsFailure;

        const baseName = getFileBaseName(fileToProcess.name);
        setResult({
          data,
          filename: method === "none" ? fileToProcess.name : `${baseName}_compressed.pdf`,
          originalSize: fileToProcess.size,
          compressedSize: data.length,
          level,
          method,
          levelMatters: imageHeavy,
        });
      } catch (err) {
        setError(compressErrorMessage(err));
      } finally {
        setStageMessage("");
        stopProcessing();
      }
    },
    [gsCompress, releaseGhostscript, startProcessing, setError, clearError, stopProcessing],
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

  // Offer the next level up whenever the result is thin, so the answer to "this
  // barely shrank" is a button rather than a dead end.
  const harderLevel = useMemo(() => {
    if (!result?.levelMatters) return null;
    const saved = 1 - result.compressedSize / Math.max(result.originalSize, 1);
    return saved < 0.5 ? nextLevel(result.level) : null;
  }, [result]);

  const handleCompressHarder = useCallback(() => {
    if (!file || !harderLevel) return;
    setCompressionLevel(harderLevel);
    processFile(file, harderLevel);
  }, [file, harderLevel, processFile]);

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
          title={resultTitle(result)}
          subtitle={resultSubtitle(result)}
          data={result.data}
          size={result.compressedSize}
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        >
          {harderLevel && (
            <button type="button" onClick={handleCompressHarder} className="btn-secondary w-full">
              <CompressIcon className="w-4 h-4" />
              Squeeze harder — {harderLevel} compression
            </button>
          )}
        </PdfResultView>
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
            Images are downsampled and re-encoded for the big wins; text-heavy PDFs fall back to a lossless repack that
            leaves quality untouched. Whichever comes out smaller is what you get. First use may take longer to load.
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
                {stageMessage || gsProgress || "Compressing..."}
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

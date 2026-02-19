"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeftIcon, DownloadIcon, LoaderIcon, OcrIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { createSearchablePDF } from "@/lib/ocr-utils";
import { pdfToImages } from "@/lib/pdf-image-utils";

type OCRMode = "searchable" | "extract";

// Static data hoisted outside component to avoid recreation on each render
const LANGUAGES = [
  { code: "eng", name: "English" },
  { code: "spa", name: "Spanish" },
  { code: "fra", name: "French" },
  { code: "deu", name: "German" },
  { code: "ita", name: "Italian" },
  { code: "por", name: "Portuguese" },
  { code: "chi_sim", name: "Chinese (Simplified)" },
  { code: "chi_tra", name: "Chinese (Traditional)" },
  { code: "jpn", name: "Japanese" },
  { code: "kor", name: "Korean" },
  { code: "ara", name: "Arabic" },
  { code: "rus", name: "Russian" },
] as const;

export default function OcrPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<OCRMode>("searchable");
  const [statusText, setStatusText] = useState("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [searchablePdf, setSearchablePdf] = useState<Uint8Array | null>(null);
  const [language, setLanguage] = useState("eng");
  const [copied, setCopied] = useState(false);

  // Use custom hook for processing state
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (fileToProcess: File, ocrMode: OCRMode, lang: string) => {
      if (!startProcessing()) return;
      setExtractedText("");
      setSearchablePdf(null);

      try {
        if (ocrMode === "searchable") {
          const pdfData = await createSearchablePDF(fileToProcess, {
            language: lang,
            onProgress: (percent, status) => {
              setProgress(percent);
              setStatusText(status);
            },
          });
          setSearchablePdf(pdfData);
        } else {
          let imagesToProcess: Blob[] = [];

          if (fileToProcess.type === "application/pdf") {
            setStatusText("Converting PDF pages to images...");
            const images = await pdfToImages(fileToProcess, {
              scale: 2,
              onProgress: (current, total) => {
                setProgress(Math.round((current / total) * 30));
              },
            });
            imagesToProcess = images.map((i) => i.blob);
          } else {
            imagesToProcess = [fileToProcess];
          }

          setStatusText("Extracting text with OCR...");

          // Lazy load Tesseract.js only when needed
          const Tesseract = await import("tesseract.js");

          const allText: string[] = [];

          for (let i = 0; i < imagesToProcess.length; i++) {
            const result = await Tesseract.recognize(imagesToProcess[i], lang, {
              logger: (m) => {
                if (m.status === "recognizing text") {
                  const pageProgress = m.progress * 100;
                  const overallProgress = 30 + ((i + pageProgress / 100) / imagesToProcess.length) * 70;
                  setProgress(Math.round(overallProgress));
                }
              },
            });

            if (imagesToProcess.length > 1) {
              allText.push(`--- Page ${i + 1} ---\n${result.data.text}`);
            } else {
              allText.push(result.data.text);
            }
          }

          setExtractedText(allText.join("\n\n"));
        }
        setProgress(100);
      } catch (err) {
        setError(getErrorMessage(err, "OCR processing failed"));
      } finally {
        stopProcessing();
        setStatusText("");
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        setFile(files[0]);
        clearError();
        setExtractedText("");
        setSearchablePdf(null);

        if (isInstant) {
          // Instant mode: create searchable PDF with English
          processFile(files[0], "searchable", "eng");
        }
      }
    },
    [isInstant, processFile, clearError],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    clearError();
    setExtractedText("");
    setSearchablePdf(null);
  }, [clearError]);

  const handleProcess = useCallback(async () => {
    if (!file) return;
    processFile(file, mode, language);
  }, [file, mode, language, processFile]);

  const handleCopyText = useCallback(async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [extractedText]);

  const handleDownloadText = useCallback(() => {
    const filename = file ? `${file.name.replace(/\.[^.]+$/, "")}_ocr.txt` : "extracted_text.txt";
    downloadBlob(new Blob([extractedText], { type: "text/plain" }), filename);
  }, [extractedText, file]);

  const handleDownloadSearchablePdf = useCallback(() => {
    if (searchablePdf && file) {
      const filename = `${file.name.replace(/\.[^.]+$/, "")}_searchable.pdf`;
      downloadBlob(searchablePdf, filename);
    }
  }, [searchablePdf, file]);

  const handleStartOver = useCallback(() => {
    setFile(null);
    setExtractedText("");
    setSearchablePdf(null);
    clearError();
  }, [clearError]);

  // Mode handlers
  const setModeSearchable = useCallback(() => setMode("searchable"), []);
  const setModeExtract = useCallback(() => setMode("extract"), []);

  // Language handler
  const handleLanguageSelect = useCallback((code: string) => {
    setLanguage(code);
  }, []);

  const hasResult = extractedText || searchablePdf;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-6">
        <Link href="/" className="back-link">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to tools
        </Link>

        <div className="flex items-center gap-5">
          <div className="tool-icon tool-ocr">
            <OcrIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-4xl font-display">OCR</h1>
            <p className="text-muted-foreground mt-1">Make scanned PDFs searchable or extract text</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {!file ? (
        <div className="max-w-2xl mx-auto">
          <FileDropzone
            accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF or image here"
            subtitle="PDF, PNG, JPG, GIF, BMP, WebP"
          />
        </div>
      ) : hasResult ? (
        <div className="space-y-6">
          {searchablePdf ? (
            /* Searchable PDF Result */
            <div className="animate-fade-up max-w-2xl mx-auto">
              <div className="success-card">
                <div className="success-stamp">
                  <span className="success-stamp-text">Searchable</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <div className="space-y-2 mb-8">
                  <h2 className="text-3xl font-display">PDF is now searchable!</h2>
                  <p className="text-muted-foreground">Text is now selectable and searchable in PDF viewers</p>
                  <p className="text-sm text-muted-foreground">
                    File size: {(searchablePdf.length / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button type="button" onClick={handleDownloadSearchablePdf} className="btn-success flex-1">
                    <DownloadIcon className="w-5 h-5" />
                    Download PDF
                  </button>
                  <button type="button" onClick={handleStartOver} className="btn-secondary flex-1">
                    Process Another File
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Text Extraction Result */
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border-2 border-foreground">
                <span className="font-bold">Extracted Text</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className={`px-4 py-2 border-2 border-foreground font-bold text-sm transition-all
                      ${copied ? "bg-[#2D5A3D] text-white" : "bg-muted hover:bg-accent"}
                    `}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadText}
                    className="px-4 py-2 bg-muted border-2 border-foreground font-bold text-sm hover:bg-accent transition-colors"
                  >
                    Download .txt
                  </button>
                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="px-4 py-2 text-muted-foreground font-semibold text-sm hover:text-foreground transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              </div>

              <div className="border-2 border-foreground bg-white p-6 max-h-[500px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">{extractedText}</pre>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* File Info */}
          <div className="file-item">
            <div className="pdf-icon-box">
              {file.type === "application/pdf" ? (
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {file.type === "application/pdf" ? "PDF Document" : "Image"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Change file
            </button>
          </div>

          {/* Mode Selection */}
          <div className="p-6 bg-card border-2 border-foreground space-y-3">
            <span className="input-label" id="output-mode-label">Output Mode</span>
            <div className="flex gap-2" role="group" aria-labelledby="output-mode-label">
              <button
                type="button"
                onClick={setModeSearchable}
                className={`flex-1 px-4 py-3 border-2 font-bold text-sm transition-all text-left
                  ${
                    mode === "searchable"
                      ? "bg-primary border-foreground text-white"
                      : "bg-muted border-foreground hover:bg-accent"
                  }
                `}
              >
                <div>Searchable PDF</div>
                <div
                  className={`text-xs font-normal mt-1 ${mode === "searchable" ? "text-white/80" : "text-muted-foreground"}`}
                >
                  Makes text selectable in the PDF
                </div>
              </button>
              <button
                type="button"
                onClick={setModeExtract}
                className={`flex-1 px-4 py-3 border-2 font-bold text-sm transition-all text-left
                  ${
                    mode === "extract"
                      ? "bg-primary border-foreground text-white"
                      : "bg-muted border-foreground hover:bg-accent"
                  }
                `}
              >
                <div>Extract Text</div>
                <div
                  className={`text-xs font-normal mt-1 ${mode === "extract" ? "text-white/80" : "text-muted-foreground"}`}
                >
                  Copy text to clipboard or .txt file
                </div>
              </button>
            </div>
          </div>

          {/* Language Selection */}
          <div className="p-6 bg-card border-2 border-foreground space-y-4">
            <span className="input-label">Language</span>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.slice(0, 6).map((lang) => (
                <button
                  type="button"
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`px-4 py-2 border-2 font-bold text-sm transition-all
                    ${
                      language === lang.code
                        ? "bg-primary border-foreground text-white"
                        : "bg-muted border-foreground hover:bg-accent"
                    }
                  `}
                >
                  {lang.name}
                </button>
              ))}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground font-semibold hover:text-foreground transition-colors">
                More languages...
              </summary>
              <div className="flex flex-wrap gap-2 mt-3">
                {LANGUAGES.slice(6).map((lang) => (
                  <button
                    type="button"
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`px-4 py-2 border-2 font-bold text-sm transition-all
                      ${
                        language === lang.code
                          ? "bg-primary border-foreground text-white"
                          : "bg-muted border-foreground hover:bg-accent"
                      }
                    `}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Info Box */}
          <InfoBox title="About OCR">
            <ul className="list-disc list-inside space-y-0.5">
              <li>Works best with clear, high-resolution scans</li>
              <li>Searchable PDF keeps the original look but adds selectable text</li>
              <li>Processing takes ~5-10 seconds per page</li>
              <li>First use may take longer while loading language data</li>
            </ul>
          </InfoBox>

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <div className="space-y-3">
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                <LoaderIcon className="w-4 h-4" />
                <span>
                  {statusText || "Processing..."} {progress}%
                </span>
              </div>
            </div>
          )}

          <button type="button" onClick={handleProcess} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Processing...
              </>
            ) : mode === "searchable" ? (
              <>
                <OcrIcon className="w-5 h-5" />
                Create Searchable PDF
              </>
            ) : (
              <>
                <OcrIcon className="w-5 h-5" />
                Extract Text
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

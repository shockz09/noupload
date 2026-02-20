"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { PdfIcon, SplitIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { downloadBlob, downloadMultiple } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { extractPages, getPDFPageCount, splitPDF } from "@/lib/pdf-utils";
import { getFileBaseName } from "@/lib/utils";

type SplitMode = "extract" | "range" | "each";

interface SplitResult {
  files: { data: Uint8Array; filename: string }[];
  mode: SplitMode;
}

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SplitMode>("extract");
  const [extractInput, setExtractInput] = useState("");
  const [rangeInput, setRangeInput] = useState("");
  const [result, setResult] = useState<SplitResult | null>(null);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);
      try {
        const count = await getPDFPageCount(selectedFile);
        setPageCount(count);
      } catch {
        setError("Could not read PDF file");
      }
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setPageCount(0);
    setError(null);
    setResult(null);
    setExtractInput("");
    setRangeInput("");
  }, []);

  const parsePageNumbers = (input: string): number[] => {
    const pages: number[] = [];
    const parts = input.split(",").map((p) => p.trim());
    for (const part of parts) {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!Number.isNaN(num) && !pages.includes(num)) pages.push(num);
      }
    }
    return pages.sort((a, b) => a - b);
  };

  const parseRanges = (input: string): { start: number; end: number }[] => {
    const ranges: { start: number; end: number }[] = [];
    const parts = input.split(",").map((p) => p.trim());
    for (const part of parts) {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          ranges.push({ start: start - 1, end: end - 1 });
        }
      } else {
        const num = parseInt(part, 10);
        if (!Number.isNaN(num)) {
          ranges.push({ start: num - 1, end: num - 1 });
        }
      }
    }
    return ranges;
  };

  const handleSplit = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const baseName = getFileBaseName(file.name);
      let resultFiles: { data: Uint8Array; filename: string }[] = [];

      if (mode === "extract") {
        const pages = parsePageNumbers(extractInput);
        if (pages.length === 0) {
          throw new Error("Please enter valid page numbers");
        }
        setProgress(30);
        const data = await extractPages(file, pages);
        setProgress(90);
        resultFiles = [{ data, filename: `${baseName}_pages_${pages.join("-")}.pdf` }];
      } else if (mode === "range") {
        const ranges = parseRanges(rangeInput);
        if (ranges.length === 0) {
          throw new Error("Please enter valid page ranges");
        }
        setProgress(30);
        const results = await splitPDF(file, ranges);
        setProgress(90);
        resultFiles = results.map((data, i) => ({
          data,
          filename: `${baseName}_part${i + 1}.pdf`,
        }));
      } else if (mode === "each") {
        setProgress(10);
        const ranges = Array.from({ length: pageCount }, (_, i) => ({
          start: i,
          end: i,
        }));
        const results = await splitPDF(file, ranges);
        setProgress(90);
        resultFiles = results.map((data, i) => ({
          data,
          filename: `${baseName}_page${i + 1}.pdf`,
        }));
      }

      setResult({ files: resultFiles, mode });
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to split PDF"));
    } finally {
      setIsProcessing(false);
    }
  }, [file, mode, extractInput, rangeInput, pageCount]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) {
        if (result.files.length === 1) {
          downloadBlob(result.files[0].data, result.files[0].filename);
        } else {
          downloadMultiple(result.files);
        }
      }
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setPageCount(0);
    setResult(null);
    setError(null);
    setProgress(0);
    setExtractInput("");
    setRangeInput("");
  }, []);

  // Input handlers
  const handleExtractInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExtractInput(e.target.value);
  }, []);

  const handleRangeInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRangeInput(e.target.value);
  }, []);

  // Mode handlers
  const setModeExtract = useCallback(() => setMode("extract"), []);
  const setModeRange = useCallback(() => setMode("range"), []);
  const setModeEach = useCallback(() => setMode("each"), []);

  const modes = useMemo(
    () => [
      { value: "extract" as const, label: "Extract Pages", handler: setModeExtract },
      { value: "range" as const, label: "Split by Range", handler: setModeRange },
      { value: "each" as const, label: "Every Page", handler: setModeEach },
    ],
    [setModeExtract, setModeRange, setModeEach],
  );

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<SplitIcon className="w-7 h-7" />}
        iconClass="tool-split"
        title="Split PDF"
        description="Extract pages or divide into multiple files"
      />

      {result ? (
        <SuccessCard
          stampText="Complete"
          title="PDF Split!"
          downloadLabel={result.files.length === 1 ? "Download PDF" : `Download ${result.files.length} Files`}
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Split Another PDF"
        >
          <p className="text-muted-foreground">
            {result.files.length === 1 ? "Your extracted pages are ready" : `Created ${result.files.length} PDF files`}
          </p>
        </SuccessCard>
      ) : !file ? (
        <FileDropzone
          accept=".pdf"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your PDF file here"
        />
      ) : (
        <div className="space-y-6">
          <PdfFileInfo
            file={file}
            fileSize={`${pageCount} pages`}
            onClear={handleClear}
            icon={<PdfIcon className="w-5 h-5" />}
          />

          {/* Mode Selection */}
          <div className="mode-selector">
            {modes.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={m.handler}
                className={`mode-option ${mode === m.value ? "active" : ""}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Mode-specific inputs */}
          {mode === "extract" && (
            <div className="space-y-2">
              <label htmlFor="extract-pages" className="input-label">Pages to extract</label>
              <input
                id="extract-pages"
                type="text"
                placeholder="e.g., 1, 3, 5-10"
                value={extractInput}
                onChange={handleExtractInputChange}
                className="input-field"
              />
              <p className="text-xs text-muted-foreground">
                Enter page numbers separated by commas. Use ranges like 5-10.
              </p>
            </div>
          )}

          {mode === "range" && (
            <div className="space-y-2">
              <label htmlFor="page-ranges" className="input-label">Page ranges</label>
              <input
                id="page-ranges"
                type="text"
                placeholder="e.g., 1-3, 4-6, 7-10"
                value={rangeInput}
                onChange={handleRangeInputChange}
                className="input-field"
              />
              <p className="text-xs text-muted-foreground">Each range will become a separate PDF file.</p>
            </div>
          )}

          {mode === "each" && (
            <div className="info-box">
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="text-sm">
                Each page will be saved as a separate PDF. This will create <strong>{pageCount} files</strong>.
              </span>
            </div>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Processing..." />}

          <button type="button" onClick={handleSplit} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Processing...
              </>
            ) : (
              <>
                <SplitIcon className="w-5 h-5" />
                Split PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/merge")({
	head: () => ({
		meta: [
			{ title: "Merge PDF Files Online Free - Combine PDFs | noupload" },
			{ name: "description", content: "Combine multiple PDF files into one document for free. Drag and drop to reorder pages. Works offline in your browser, no file uploads." },
			{ name: "keywords", content: "merge pdf, combine pdf, join pdf, pdf merger, free pdf combiner, merge pdf online" },
			{ property: "og:title", content: "Merge PDF Files Online Free - Combine PDFs" },
			{ property: "og:description", content: "Combine multiple PDF files into one document for free. Works 100% offline in your browser." },
		],
	}),
	component: MergePage,
});

import { useCallback, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { MergeIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { FileList } from "@/components/pdf/file-list";
import { ErrorBox, PdfPageHeader, PdfResultView } from "@/components/pdf/shared";
import { useFileBuffer, useFileProcessing, usePdfDataResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { mergePDFs } from "@/lib/pdf-utils";
import { getFileBaseName } from "@/lib/utils";

interface FileItem {
  file: File;
  id: string;
}

interface MergeMetadata {
  originalCount: number;
  totalSize: number;
}

function MergePage() {
  const [files, setFiles] = useState<FileItem[]>([]);

  // Use custom hooks
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = usePdfDataResult<MergeMetadata>();

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      const newItems = newFiles.map((file) => ({
        file,
        id: crypto.randomUUID(),
      }));
      setFiles((prev) => [...prev, ...newItems]);
      clearResult();
    },
    [clearResult],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      clearResult();
    },
    [clearResult],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setFiles((prev) => {
        const newFiles = [...prev];
        const [moved] = newFiles.splice(fromIndex, 1);
        newFiles.splice(toIndex, 0, moved);
        return newFiles;
      });
      clearResult();
    },
    [clearResult],
  );

  const handleClear = useCallback(() => {
    setFiles([]);
    clearResult();
  }, [clearResult]);

  const handleMerge = useCallback(async () => {
    if (files.length < 2) {
      setError("Please select at least 2 PDF files to merge");
      return;
    }

    if (!startProcessing()) return;

    try {
      setProgress(20);
      await new Promise((r) => setTimeout(r, 100));

      setProgress(40);
      const mergedPdf = await mergePDFs(files.map((f) => f.file));

      setProgress(80);
      await new Promise((r) => setTimeout(r, 100));

      const firstName = getFileBaseName(files[0].file.name);
      const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

      setResult(mergedPdf, `${firstName}_merged.pdf`, { originalCount: files.length, totalSize });
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to merge PDFs"));
    } finally {
      stopProcessing();
    }
  }, [files, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    setFiles([]);
    clearResult();
  }, [clearResult]);

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
      sourceToolLabel: "Merge PDF",
    });
  }, [result, addToBuffer]);

  const buttonLabel = files.length > 0 ? `Merge ${files.length} PDFs` : "Merge PDFs";

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<MergeIcon className="w-7 h-7" />}
        iconClass="tool-merge"
        title="Merge PDF"
        description="Combine multiple PDFs into a single document"
      />

      {result ? (
        <PdfResultView
          title="PDFs Merged!"
          subtitle={`${result.metadata?.originalCount} files combined into one PDF`}
          data={result.data}
          size={result.data.length}
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Merge More Files"
        />
      ) : (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple
            onFilesSelected={handleFilesSelected}
            maxFiles={50}
            title="Drop your PDF files here"
            subtitle="or click to browse"
          />

          <FileList files={files} onRemove={handleRemove} onReorder={handleReorder} onClear={handleClear} />

          {error && <ErrorBox message={error} />}

          <button
            type="button"
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Merging...
              </>
            ) : (
              <>
                <MergeIcon className="w-5 h-5" />
                {buttonLabel}
              </>
            )}
          </button>

          {files.length === 1 && (
            <p className="text-sm text-muted-foreground text-center font-medium">Add at least one more PDF to merge</p>
          )}
        </div>
      )}
    </div>
  );
}

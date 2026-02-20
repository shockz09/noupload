"use client";

import { useCallback, useState } from "react";
import { DownloadIcon } from "@/components/icons/ui";
import { MetadataIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar } from "@/components/pdf/shared";
import { useFileProcessing, useProcessingResult } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getPDFMetadata, setPDFMetadata } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string | undefined;
  creationDate: Date | undefined;
  modificationDate: Date | undefined;
  pageCount: number;
}

export default function MetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [editedMetadata, setEditedMetadata] = useState<Partial<PdfMetadata>>({});

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();
  const { result, setResult, clearResult } = useProcessingResult();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const selectedFile = files[0];
      setFile(selectedFile);
      clearResult();
      clearError();

      try {
        const meta = await getPDFMetadata(selectedFile);
        const formatted: PdfMetadata = {
          title: meta.title || "",
          author: meta.author || "",
          subject: meta.subject || "",
          keywords: meta.keywords || "",
          creator: meta.creator || "",
          producer: meta.producer,
          creationDate: meta.creationDate,
          modificationDate: meta.modificationDate,
          pageCount: meta.pageCount,
        };
        setMetadata(formatted);
        setEditedMetadata(formatted);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to read PDF metadata"));
      }
    },
    [clearResult, clearError, setError],
  );

  const handleSave = useCallback(async () => {
    if (!file || !startProcessing()) return;

    try {
      setProgress(30);
      const pdfBytes = await setPDFMetadata(file, {
        title: editedMetadata.title,
        author: editedMetadata.author,
        subject: editedMetadata.subject,
        keywords: editedMetadata.keywords,
        creator: editedMetadata.creator,
      });
      setProgress(90);

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      setResult(blob, `${getFileBaseName(file.name)}_metadata.pdf`);
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update metadata"));
    } finally {
      stopProcessing();
    }
  }, [file, editedMetadata, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(() => {
    if (result) {
      result.blob.arrayBuffer().then((buffer) => {
        downloadBlob(new Uint8Array(buffer), result.filename);
      });
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setFile(null);
    setMetadata(null);
    setEditedMetadata({});
    clearResult();
    clearError();
  }, [clearResult, clearError]);

  const handleInputChange = (field: keyof PdfMetadata, value: string) => {
    setEditedMetadata((prev) => ({ ...prev, [field]: value }));
  };

  const hasChanges =
    metadata &&
    (editedMetadata.title !== metadata.title ||
      editedMetadata.author !== metadata.author ||
      editedMetadata.subject !== metadata.subject ||
      editedMetadata.keywords !== metadata.keywords ||
      editedMetadata.creator !== metadata.creator);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<MetadataIcon className="w-7 h-7" />}
        iconClass="tool-metadata"
        title="PDF Metadata Editor"
        description="View and edit PDF document properties"
      />

      {result ? (
        <div className="success-card animate-fade-up">
          <div className="success-stamp">
            <span className="success-stamp-text">Updated</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-3xl font-display mb-2">Metadata Updated!</h2>
          <p className="text-muted-foreground mb-6">Your PDF metadata has been updated successfully.</p>
          <button type="button" onClick={handleDownload} className="btn-success w-full mb-4">
            <DownloadIcon className="w-5 h-5" />
            Download PDF
          </button>
          <button type="button" onClick={handleClear} className="btn-secondary w-full">
            Edit Another PDF
          </button>
        </div>
      ) : !file ? (
        <FileDropzone
          accept=".pdf"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your PDF here"
          subtitle="to view and edit metadata"
        />
      ) : (
        <div className="space-y-6">
          <PdfFileInfo file={file} fileSize={formatFileSize(file.size)} onClear={handleClear} />

          {metadata && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label htmlFor="meta-title" className="input-label block mb-1">
                    Title
                  </label>
                  <input
                    id="meta-title"
                    type="text"
                    value={editedMetadata.title || ""}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className="input-field w-full"
                    placeholder="Document title"
                  />
                </div>

                <div>
                  <label htmlFor="meta-author" className="input-label block mb-1">
                    Author
                  </label>
                  <input
                    id="meta-author"
                    type="text"
                    value={editedMetadata.author || ""}
                    onChange={(e) => handleInputChange("author", e.target.value)}
                    className="input-field w-full"
                    placeholder="Author name"
                  />
                </div>

                <div>
                  <label htmlFor="meta-subject" className="input-label block mb-1">
                    Subject
                  </label>
                  <input
                    id="meta-subject"
                    type="text"
                    value={editedMetadata.subject || ""}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    className="input-field w-full"
                    placeholder="Document subject"
                  />
                </div>

                <div>
                  <label htmlFor="meta-keywords" className="input-label block mb-1">
                    Keywords
                  </label>
                  <input
                    id="meta-keywords"
                    type="text"
                    value={editedMetadata.keywords || ""}
                    onChange={(e) => handleInputChange("keywords", e.target.value)}
                    className="input-field w-full"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>

                <div>
                  <label htmlFor="meta-creator" className="input-label block mb-1">
                    Creator
                  </label>
                  <input
                    id="meta-creator"
                    type="text"
                    value={editedMetadata.creator || ""}
                    onChange={(e) => handleInputChange("creator", e.target.value)}
                    className="input-field w-full"
                    placeholder="Application that created the PDF"
                  />
                </div>
              </div>

              <div className="border-2 border-foreground p-4 bg-muted/30 space-y-2">
                <p className="text-sm font-bold">Read-only Properties</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Producer:</span>
                  <span>{metadata.producer || "—"}</span>
                  <span className="text-muted-foreground">Pages:</span>
                  <span>{metadata.pageCount}</span>
                  <span className="text-muted-foreground">Created:</span>
                  <span>{metadata.creationDate?.toLocaleDateString() || "—"}</span>
                  <span className="text-muted-foreground">Modified:</span>
                  <span>{metadata.modificationDate?.toLocaleDateString() || "—"}</span>
                </div>
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Updating metadata..." />}

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing || !hasChanges}
            className="btn-primary w-full"
          >
            <MetadataIcon className="w-5 h-5" />
            {isProcessing ? "Saving..." : "Save Metadata"}
          </button>
        </div>
      )}
    </div>
  );
}

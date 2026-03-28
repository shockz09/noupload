"use client";

import { useCallback, useState } from "react";
import { MetadataIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useFileProcessing, useProcessingResult } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getPDFMetadata, sanitizePDF, setPDFMetadata } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

type Tab = "edit" | "properties";

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

interface MetadataResult {
  mode: "edit" | "strip";
  removedFields?: string[];
}

const EDITABLE_FIELDS = [
  { key: "title", label: "Title", placeholder: "Document title" },
  { key: "author", label: "Author", placeholder: "Author name" },
  { key: "subject", label: "Subject", placeholder: "Document subject" },
  { key: "keywords", label: "Keywords", placeholder: "keyword1, keyword2, keyword3" },
  { key: "creator", label: "Creator", placeholder: "Application that created the PDF" },
] as const;

export default function MetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [editedMetadata, setEditedMetadata] = useState<Partial<PdfMetadata>>({});
  const [activeTab, setActiveTab] = useState<Tab>("edit");

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();
  const { result, setResult, clearResult } = useProcessingResult<MetadataResult>();

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
      setResult(blob, `${getFileBaseName(file.name)}_metadata.pdf`, { mode: "edit" });
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update metadata"));
    } finally {
      stopProcessing();
    }
  }, [file, editedMetadata, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleStrip = useCallback(async () => {
    if (!file || !startProcessing()) return;

    try {
      setProgress(30);
      const { data, removedFields } = await sanitizePDF(file);
      setProgress(90);

      const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
      setResult(blob, `${getFileBaseName(file.name)}_sanitized.pdf`, {
        mode: "strip",
        removedFields,
      });
      setProgress(100);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to strip metadata"));
    } finally {
      stopProcessing();
    }
  }, [file, startProcessing, setProgress, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) {
        result.blob.arrayBuffer().then((buffer) => {
          downloadBlob(new Uint8Array(buffer), result.filename);
        });
      }
    },
    [result],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setMetadata(null);
    setEditedMetadata({});
    setActiveTab("edit");
    clearResult();
    clearError();
  }, [clearResult, clearError]);

  function handleInputChange(field: keyof PdfMetadata, value: string): void {
    setEditedMetadata((prev) => ({ ...prev, [field]: value }));
  }

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
        title="PDF Metadata"
        description="View, edit, or strip PDF document properties"
      />

      {result ? (
        <SuccessCard
          stampText={result.metadata?.mode === "strip" ? "Cleaned" : "Updated"}
          title={result.metadata?.mode === "strip" ? "PDF Sanitized!" : "Metadata Updated!"}
          downloadLabel="Download PDF"
          onDownload={handleDownload}
          onStartOver={handleClear}
          startOverLabel="Edit Another PDF"
        >
          {result.metadata?.mode === "strip" && result.metadata.removedFields && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Removed {result.metadata.removedFields.length} metadata{" "}
                {result.metadata.removedFields.length === 1 ? "field" : "fields"}
              </p>
              {result.metadata.removedFields.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {result.metadata.removedFields.map((field) => (
                    <span key={field} className="px-2 py-1 bg-muted text-xs font-medium rounded">
                      {field}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF here"
            subtitle="to view and edit metadata"
          />

          <InfoBox title="All-in-one metadata tool">
            View and edit title, author, subject, keywords — or strip all metadata for privacy.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo file={file} fileSize={formatFileSize(file.size)} onClear={handleClear} />

          {metadata && (
            <>
              {/* Tab Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`flex-1 px-4 py-2.5 text-sm font-bold border-2 transition-all ${
                    activeTab === "edit"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <MetadataIcon className="w-4 h-4" />
                    View & Edit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("properties")}
                  className={`flex-1 px-4 py-2.5 text-sm font-bold border-2 transition-all ${
                    activeTab === "properties"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  Properties
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === "edit" ? (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {EDITABLE_FIELDS.map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label htmlFor={`meta-${key}`} className="input-label block mb-1">
                          {label}
                        </label>
                        <input
                          id={`meta-${key}`}
                          type="text"
                          value={(editedMetadata[key] as string) || ""}
                          onChange={(e) => handleInputChange(key, e.target.value)}
                          className="input-field w-full"
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>

                  {error && <ErrorBox message={error} />}
                  {isProcessing && <ProgressBar progress={progress} label="Processing..." />}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isProcessing || !hasChanges}
                    className="btn-primary w-full"
                  >
                    <MetadataIcon className="w-5 h-5" />
                    {isProcessing ? "Saving..." : "Save Changes"}
                  </button>

                  {/* Danger zone — visually separated */}
                  <div className="border-t-2 border-dashed border-foreground/20 pt-5 mt-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Privacy</p>
                    <button
                      type="button"
                      onClick={handleStrip}
                      disabled={isProcessing}
                      className="btn-secondary w-full"
                    >
                      Strip All Current Metadata
                    </button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Removes title, author, dates, and all other document properties.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-foreground p-4 bg-muted/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <span className="text-muted-foreground font-medium">Producer</span>
                      <span className="break-all">{metadata.producer || "---"}</span>

                      <span className="text-muted-foreground font-medium">Page Count</span>
                      <span>{metadata.pageCount}</span>

                      <span className="text-muted-foreground font-medium">Creation Date</span>
                      <span>{metadata.creationDate?.toLocaleDateString() || "---"}</span>

                      <span className="text-muted-foreground font-medium">Modification Date</span>
                      <span>{metadata.modificationDate?.toLocaleDateString() || "---"}</span>

                      <span className="text-muted-foreground font-medium">File Size</span>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "properties" && error && <ErrorBox message={error} />}
        </div>
      )}
    </div>
  );
}

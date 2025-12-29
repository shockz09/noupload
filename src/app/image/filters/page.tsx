"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { applyFilter, downloadImage, formatFileSize, getOutputFilename, FilterType } from "@/lib/image-utils";
import { FiltersIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, SuccessCard, ImageFileInfo } from "@/components/image/shared";

interface FilterResult {
  blob: Blob;
  filename: string;
  filter: FilterType;
}

const filters: { value: FilterType; label: string; cssFilter: string }[] = [
  { value: "grayscale", label: "Grayscale", cssFilter: "grayscale(100%)" },
  { value: "sepia", label: "Sepia", cssFilter: "sepia(100%)" },
  { value: "invert", label: "Invert", cssFilter: "invert(100%)" },
];

export default function ImageFiltersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FilterResult | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setSelectedFilter(null);

      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
    }
  }, []);

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError(null);
    setResult(null);
    setSelectedFilter(null);
  }, [preview]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFileSelected([file]);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileSelected]);

  const currentFilterStyle = selectedFilter
    ? { filter: filters.find((f) => f.value === selectedFilter)?.cssFilter }
    : {};

  const handleApply = async () => {
    if (!file || !selectedFilter) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const filtered = await applyFilter(file, selectedFilter);

      setResult({
        blob: filtered,
        filename: getOutputFilename(file.name, undefined, `_${selectedFilter}`),
        filter: selectedFilter,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply filter");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (result) downloadImage(result.blob, result.filename);
  };

  const handleStartOver = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSelectedFilter(null);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<FiltersIcon className="w-7 h-7" />}
        iconClass="tool-filters"
        title="Image Filters"
        description="Apply grayscale, sepia, or invert effects"
      />

      {result ? (
        <SuccessCard
          stampText="Filtered"
          title="Filter Applied!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Apply to Another"
        >
          <p className="text-muted-foreground">
            {result.filter.charAt(0).toUpperCase() + result.filter.slice(1)} filter • {formatFileSize(result.blob.size)}
          </p>
        </SuccessCard>
      ) : !file ? (
        <FileDropzone
          accept=".jpg,.jpeg,.png,.webp"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your image here"
          subtitle="or click to browse · Ctrl+V to paste"
        />
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img
                src={preview}
                alt="Preview"
                style={currentFilterStyle}
                className="max-h-64 mx-auto object-contain transition-all duration-300"
              />
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          <div className="space-y-3">
            <label className="input-label">Select Filter</label>
            <div className="grid grid-cols-3 gap-3">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSelectedFilter(filter.value)}
                  className={`relative overflow-hidden border-2 border-foreground aspect-square transition-all ${
                    selectedFilter === filter.value ? "ring-4 ring-primary ring-offset-2" : "hover:scale-105"
                  }`}
                >
                  {preview && (
                    <img
                      src={preview}
                      alt={filter.label}
                      style={{ filter: filter.cssFilter }}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-foreground/90 py-2">
                    <span className="text-xs font-bold text-background">{filter.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedFilter && (
            <button
              onClick={() => setSelectedFilter(null)}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filter selection
            </button>
          )}

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground py-4">
              <LoaderIcon className="w-4 h-4" />
              <span>Applying filter...</span>
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={isProcessing || !selectedFilter}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <><LoaderIcon className="w-5 h-5" />Processing...</>
            ) : (
              <>
                <FiltersIcon className="w-5 h-5" />
                {selectedFilter
                  ? `Apply ${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)}`
                  : "Select a Filter"}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

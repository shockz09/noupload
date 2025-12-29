"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { applyFilter, downloadImage, formatFileSize, getOutputFilename, FilterType } from "@/lib/image-utils";
import { FiltersIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, SuccessCard } from "@/components/image/shared";

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
  const [result, setResult] = useState<{ blob: Blob; filename: string; filter: FilterType } | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
      setSelectedFilter(null);
      setPreview(URL.createObjectURL(files[0]));
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
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) handleFileSelected([f]);
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
    <div className="page-enter max-w-4xl mx-auto space-y-8">
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
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Live Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</span>
              <button onClick={handleClear} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px]">
              <img
                src={preview!}
                alt="Preview"
                style={currentFilterStyle}
                className="max-h-[180px] object-contain transition-all duration-200"
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">{file.name} • {formatFileSize(file.size)}</p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Filter Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Select Filter</label>
              <div className="grid grid-cols-3 gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setSelectedFilter(filter.value)}
                    className={`relative overflow-hidden border-2 border-foreground aspect-[4/3] transition-all ${
                      selectedFilter === filter.value ? "ring-2 ring-offset-2 ring-foreground" : "hover:scale-[1.02]"
                    }`}
                  >
                    <img
                      src={preview!}
                      alt={filter.label}
                      style={{ filter: filter.cssFilter }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-foreground/90 py-1.5">
                      <span className="text-xs font-bold text-background">{filter.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Selection */}
            {selectedFilter && (
              <button
                onClick={() => setSelectedFilter(null)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear filter selection
              </button>
            )}

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
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
        </div>
      )}
    </div>
  );
}

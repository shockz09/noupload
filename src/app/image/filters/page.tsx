"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { applyFilter, downloadImage, formatFileSize, getOutputFilename, FilterType } from "@/lib/image-utils";
import { FiltersIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader, ErrorBox, SuccessCard } from "@/components/image/shared";

const filters: { value: FilterType; label: string; cssFilter: string; pixelBased?: boolean }[] = [
  { value: "grayscale", label: "Grayscale", cssFilter: "grayscale(100%)" },
  { value: "sepia", label: "Sepia", cssFilter: "sepia(100%)" },
  { value: "invert", label: "Invert", cssFilter: "invert(100%)" },
  { value: "90s", label: "90s", cssFilter: "brightness(118%) contrast(72%) saturate(85%) hue-rotate(18deg)" },
  { value: "noir", label: "Noir", cssFilter: "", pixelBased: true },
  { value: "sunset", label: "Sunset", cssFilter: "", pixelBased: true },
  { value: "frost", label: "Frost", cssFilter: "", pixelBased: true },
  { value: "glitch", label: "Glitch", cssFilter: "", pixelBased: true },
  { value: "cyber", label: "Cyber", cssFilter: "", pixelBased: true },
  { value: "thermal", label: "Thermal", cssFilter: "", pixelBased: true },
];

// Generate pixel-based filter previews
function generatePixelPreview(img: HTMLImageElement, filter: FilterType): string {
  const canvas = document.createElement("canvas");
  const size = 150;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;

  // Draw scaled image
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2;
  ctx.drawImage(img, ox, oy, w, h);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  if (filter === "glitch") {
    const output = ctx.createImageData(size, size);
    const dst = output.data;
    const offset = Math.max(2, Math.floor(size * 0.02));

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const rx = Math.min(size - 1, x + offset);
        const ri = (y * size + rx) * 4;
        const bx = Math.max(0, x - offset);
        const bi = (y * size + bx) * 4;

        dst[i] = data[ri];
        dst[i + 1] = data[i + 1];
        dst[i + 2] = data[bi + 2];
        dst[i + 3] = data[i + 3];
      }
    }
    ctx.putImageData(output, 0, 0);
  } else if (filter === "cyber") {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];

      r = Math.min(255, Math.max(0, (r - 128) * 1.4 + 128));
      g = Math.min(255, Math.max(0, (g - 128) * 1.4 + 128));
      b = Math.min(255, Math.max(0, (b - 128) * 1.4 + 128));

      const lum = r * 0.299 + g * 0.587 + b * 0.114;

      if (lum < 128) {
        r = Math.min(255, r * 0.6 + 80);
        g = Math.min(255, g * 0.3);
        b = Math.min(255, b * 0.8 + 120);
      } else {
        r = Math.min(255, r * 0.4);
        g = Math.min(255, g * 0.9 + 60);
        b = Math.min(255, b * 0.9 + 80);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
  } else if (filter === "thermal") {
    const gradient = [
      { pos: 0, r: 0, g: 0, b: 0 },
      { pos: 0.15, r: 20, g: 0, b: 80 },
      { pos: 0.3, r: 80, g: 0, b: 120 },
      { pos: 0.45, r: 180, g: 0, b: 60 },
      { pos: 0.6, r: 255, g: 80, b: 0 },
      { pos: 0.75, r: 255, g: 180, b: 0 },
      { pos: 0.9, r: 255, g: 255, b: 100 },
      { pos: 1, r: 255, g: 255, b: 255 },
    ];
    const getColor = (t: number) => {
      for (let j = 0; j < gradient.length - 1; j++) {
        const c1 = gradient[j], c2 = gradient[j + 1];
        if (t >= c1.pos && t <= c2.pos) {
          const f = (t - c1.pos) / (c2.pos - c1.pos);
          return { r: c1.r + (c2.r - c1.r) * f, g: c1.g + (c2.g - c1.g) * f, b: c1.b + (c2.b - c1.b) * f };
        }
      }
      return gradient[gradient.length - 1];
    };
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      const c = getColor(lum);
      data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b;
    }
    ctx.putImageData(imageData, 0, 0);
  } else if (filter === "noir") {
    for (let i = 0; i < data.length; i += 4) {
      let lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      lum = lum < 80 ? lum * 0.3 : lum > 180 ? 255 - (255 - lum) * 0.3 : (lum - 80) * 2.55;
      lum = Math.min(255, Math.max(0, lum));
      data[i] = data[i + 1] = data[i + 2] = lum;
    }
    ctx.putImageData(imageData, 0, 0);
  } else if (filter === "sunset") {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.15 + 20);
      data[i + 1] = Math.min(255, data[i + 1] * 1.05 + 10);
      data[i + 2] = Math.max(0, data[i + 2] * 0.7);
    }
    ctx.putImageData(imageData, 0, 0);
  } else if (filter === "frost") {
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = Math.min(255, data[i] * 0.7 + avg * 0.2);
      data[i + 1] = Math.min(255, data[i + 1] * 0.85 + avg * 0.1 + 10);
      data[i + 2] = Math.min(255, data[i + 2] * 1.1 + 30);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL();
}

export default function ImageFiltersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pixelPreviews, setPixelPreviews] = useState<Record<string, string>>({});
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string; filter: FilterType } | null>(null);
  const [livePreview, setLivePreview] = useState<string | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      setFile(f);
      setError(null);
      setResult(null);
      setSelectedFilter(null);
      setLivePreview(null);

      const url = URL.createObjectURL(f);
      setPreview(url);

      // Generate pixel-based previews
      const img = new Image();
      img.onload = () => {
        const previews: Record<string, string> = {};
        filters.filter(f => f.pixelBased).forEach(f => {
          previews[f.value] = generatePixelPreview(img, f.value);
        });
        setPixelPreviews(previews);
      };
      img.src = url;
    }
  }, []);

  const handleClear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setPixelPreviews({});
    setError(null);
    setResult(null);
    setSelectedFilter(null);
    setLivePreview(null);
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

  // Generate live preview for pixel-based filters when selected
  useEffect(() => {
    const filterDef = filters.find(f => f.value === selectedFilter);
    if (filterDef?.pixelBased && file && preview) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const w = img.width;
        const h = img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        if (selectedFilter === "glitch") {
          const output = ctx.createImageData(w, h);
          const dst = output.data;
          const offset = Math.max(4, Math.floor(w * 0.012));
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const rx = Math.min(w - 1, x + offset);
              const ri = (y * w + rx) * 4;
              const bx = Math.max(0, x - offset);
              const bi = (y * w + bx) * 4;
              dst[i] = data[ri];
              dst[i + 1] = data[i + 1];
              dst[i + 2] = data[bi + 2];
              dst[i + 3] = data[i + 3];
            }
          }
          ctx.putImageData(output, 0, 0);
        } else if (selectedFilter === "cyber") {
          for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];
            r = Math.min(255, Math.max(0, (r - 128) * 1.4 + 128));
            g = Math.min(255, Math.max(0, (g - 128) * 1.4 + 128));
            b = Math.min(255, Math.max(0, (b - 128) * 1.4 + 128));
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            if (lum < 128) {
              r = Math.min(255, r * 0.6 + 80);
              g = Math.min(255, g * 0.3);
              b = Math.min(255, b * 0.8 + 120);
            } else {
              r = Math.min(255, r * 0.4);
              g = Math.min(255, g * 0.9 + 60);
              b = Math.min(255, b * 0.9 + 80);
            }
            data[i] = r; data[i + 1] = g; data[i + 2] = b;
          }
          ctx.putImageData(imageData, 0, 0);
        } else if (selectedFilter === "thermal") {
          const gradient = [
            { pos: 0, r: 0, g: 0, b: 0 }, { pos: 0.15, r: 20, g: 0, b: 80 },
            { pos: 0.3, r: 80, g: 0, b: 120 }, { pos: 0.45, r: 180, g: 0, b: 60 },
            { pos: 0.6, r: 255, g: 80, b: 0 }, { pos: 0.75, r: 255, g: 180, b: 0 },
            { pos: 0.9, r: 255, g: 255, b: 100 }, { pos: 1, r: 255, g: 255, b: 255 },
          ];
          const getColor = (t: number) => {
            for (let j = 0; j < gradient.length - 1; j++) {
              const c1 = gradient[j], c2 = gradient[j + 1];
              if (t >= c1.pos && t <= c2.pos) {
                const f = (t - c1.pos) / (c2.pos - c1.pos);
                return { r: c1.r + (c2.r - c1.r) * f, g: c1.g + (c2.g - c1.g) * f, b: c1.b + (c2.b - c1.b) * f };
              }
            }
            return gradient[gradient.length - 1];
          };
          for (let i = 0; i < data.length; i += 4) {
            const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
            const c = getColor(lum);
            data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b;
          }
          ctx.putImageData(imageData, 0, 0);
        } else if (selectedFilter === "noir") {
          for (let i = 0; i < data.length; i += 4) {
            let lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            lum = lum < 80 ? lum * 0.3 : lum > 180 ? 255 - (255 - lum) * 0.3 : (lum - 80) * 2.55;
            lum = Math.min(255, Math.max(0, lum));
            data[i] = data[i + 1] = data[i + 2] = lum;
          }
          ctx.putImageData(imageData, 0, 0);
        } else if (selectedFilter === "sunset") {
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.15 + 20);
            data[i + 1] = Math.min(255, data[i + 1] * 1.05 + 10);
            data[i + 2] = Math.max(0, data[i + 2] * 0.7);
          }
          ctx.putImageData(imageData, 0, 0);
        } else if (selectedFilter === "frost") {
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = Math.min(255, data[i] * 0.7 + avg * 0.2);
            data[i + 1] = Math.min(255, data[i + 1] * 0.85 + avg * 0.1 + 10);
            data[i + 2] = Math.min(255, data[i + 2] * 1.1 + 30);
          }
          ctx.putImageData(imageData, 0, 0);
        }

        setLivePreview(canvas.toDataURL());
      };
      img.src = preview;
    } else {
      setLivePreview(null);
    }
  }, [selectedFilter, file, preview]);

  const isPixelBased = filters.find(f => f.value === selectedFilter)?.pixelBased;
  const currentFilterStyle = selectedFilter && !isPixelBased
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
    setPixelPreviews({});
    setResult(null);
    setError(null);
    setSelectedFilter(null);
    setLivePreview(null);
  };

  // Get preview src for main preview
  const getPreviewSrc = () => {
    if (isPixelBased && livePreview) return livePreview;
    return preview!;
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
                src={getPreviewSrc()}
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
              <div className="grid grid-cols-5 gap-1.5">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setSelectedFilter(filter.value)}
                    className={`relative overflow-hidden border-2 border-foreground aspect-square transition-all ${
                      selectedFilter === filter.value ? "ring-2 ring-offset-1 ring-foreground" : "hover:scale-[1.03]"
                    }`}
                  >
                    <img
                      src={filter.pixelBased && pixelPreviews[filter.value] ? pixelPreviews[filter.value] : preview!}
                      alt={filter.label}
                      style={filter.pixelBased ? {} : { filter: filter.cssFilter }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-foreground/90 py-0.5">
                      <span className="text-[10px] font-bold text-background">{filter.label}</span>
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

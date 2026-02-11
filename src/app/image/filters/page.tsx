"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiltersIcon, LoaderIcon } from "@/components/icons";
import { ErrorBox, ImagePageHeader, SuccessCard } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import {
  applyFilter,
  copyImageToClipboard,
  type FilterType,
  formatFileSize,
  getOutputFilename,
} from "@/lib/image-utils";

interface FilterMetadata {
  filter: FilterType;
}

// Thermal gradient for heat map effect - hoisted to avoid recreation
const THERMAL_GRADIENT = [
  { pos: 0, r: 0, g: 0, b: 0 },
  { pos: 0.15, r: 20, g: 0, b: 80 },
  { pos: 0.3, r: 80, g: 0, b: 120 },
  { pos: 0.45, r: 180, g: 0, b: 60 },
  { pos: 0.6, r: 255, g: 80, b: 0 },
  { pos: 0.75, r: 255, g: 180, b: 0 },
  { pos: 0.9, r: 255, g: 255, b: 100 },
  { pos: 1, r: 255, g: 255, b: 255 },
] as const;

const filters: {
  value: FilterType;
  label: string;
  cssFilter: string;
  pixelBased?: boolean;
}[] = [
  { value: "grayscale", label: "Grayscale", cssFilter: "grayscale(100%)" },
  { value: "sepia", label: "Sepia", cssFilter: "sepia(100%)" },
  { value: "invert", label: "Invert", cssFilter: "invert(100%)" },
  {
    value: "90s",
    label: "90s",
    cssFilter: "brightness(118%) contrast(72%) saturate(85%) hue-rotate(18deg)",
  },
  { value: "noir", label: "Noir", cssFilter: "", pixelBased: true },
  { value: "sunset", label: "Sunset", cssFilter: "", pixelBased: true },
  { value: "frost", label: "Frost", cssFilter: "", pixelBased: true },
  { value: "glitch", label: "Glitch", cssFilter: "", pixelBased: true },
  { value: "cyber", label: "Cyber", cssFilter: "", pixelBased: true },
  { value: "thermal", label: "Thermal", cssFilter: "", pixelBased: true },
];

function generatePixelPreview(img: HTMLImageElement, filter: FilterType): string {
  const canvas = document.createElement("canvas");
  const size = 150;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
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
      let r = data[i],
        g = data[i + 1],
        b = data[i + 2];
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
    const getColor = (t: number) => {
      for (let j = 0; j < THERMAL_GRADIENT.length - 1; j++) {
        const c1 = THERMAL_GRADIENT[j],
          c2 = THERMAL_GRADIENT[j + 1];
        if (t >= c1.pos && t <= c2.pos) {
          const f = (t - c1.pos) / (c2.pos - c1.pos);
          return { r: c1.r + (c2.r - c1.r) * f, g: c1.g + (c2.g - c1.g) * f, b: c1.b + (c2.b - c1.b) * f };
        }
      }
      return THERMAL_GRADIENT[THERMAL_GRADIENT.length - 1];
    };
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      const c = getColor(lum);
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
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
  const [pixelPreviews, setPixelPreviews] = useState<Record<string, string>>({});
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { url: livePreview, setSource: setLivePreview, revoke: revokeLivePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult<FilterMetadata>();

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const f = files[0];
        setFile(f);
        clearResult();
        setSelectedFilter(null);
        revokeLivePreview();
        setPreview(f);

        const img = new Image();
        const tempUrl = URL.createObjectURL(f);
        img.onload = () => {
          URL.revokeObjectURL(tempUrl);
          const previews: Record<string, string> = {};
          filters
            .filter((fl) => fl.pixelBased)
            .forEach((fl) => {
              previews[fl.value] = generatePixelPreview(img, fl.value);
            });
          setPixelPreviews(previews);
        };
        img.onerror = () => {
          URL.revokeObjectURL(tempUrl);
        };
        img.src = tempUrl;
      }
    },
    [clearResult, setPreview, revokeLivePreview],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    revokeLivePreview();
    setFile(null);
    setPixelPreviews({});
    clearResult();
    setSelectedFilter(null);
  }, [revokePreview, revokeLivePreview, clearResult]);

  // Generate live preview for pixel-based filters
  useEffect(() => {
    const filterDef = filters.find((f) => f.value === selectedFilter);
    if (filterDef?.pixelBased && file && preview) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const w = img.width,
          h = img.height;
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
            let r = data[i],
              g = data[i + 1],
              b = data[i + 2];
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
        } else if (selectedFilter === "thermal") {
          const thermalLUT = new Uint8Array(256 * 3);
          for (let i = 0; i < 256; i++) {
            const t = i / 255;
            let r = 255,
              g = 255,
              b = 255;
            for (let j = 0; j < THERMAL_GRADIENT.length - 1; j++) {
              const c1 = THERMAL_GRADIENT[j],
                c2 = THERMAL_GRADIENT[j + 1];
              if (t >= c1.pos && t <= c2.pos) {
                const f = (t - c1.pos) / (c2.pos - c1.pos);
                r = c1.r + (c2.r - c1.r) * f;
                g = c1.g + (c2.g - c1.g) * f;
                b = c1.b + (c2.b - c1.b) * f;
                break;
              }
            }
            thermalLUT[i * 3] = r;
            thermalLUT[i * 3 + 1] = g;
            thermalLUT[i * 3 + 2] = b;
          }
          for (let i = 0; i < data.length; i += 4) {
            const lum = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            const idx = lum * 3;
            data[i] = thermalLUT[idx];
            data[i + 1] = thermalLUT[idx + 1];
            data[i + 2] = thermalLUT[idx + 2];
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
        canvas.toBlob(
          (blob) => {
            if (blob) setLivePreview(blob);
          },
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => {
        // Silently fail for live preview - user still has the original
      };
      img.src = preview;
    } else {
      revokeLivePreview();
    }
  }, [selectedFilter, file, preview, setLivePreview, revokeLivePreview]);

  const selectedFilterData = useMemo(() => filters.find((f) => f.value === selectedFilter), [selectedFilter]);
  const isPixelBased = selectedFilterData?.pixelBased;
  const currentFilterStyle = useMemo(
    () => (selectedFilter && !isPixelBased ? { filter: selectedFilterData?.cssFilter } : {}),
    [selectedFilter, isPixelBased, selectedFilterData?.cssFilter],
  );

  const handleApply = useCallback(async () => {
    if (!file || !selectedFilter) return;
    if (!startProcessing()) return;
    try {
      const filtered = await applyFilter(file, selectedFilter);
      setResult(filtered, getOutputFilename(file.name, undefined, `_${selectedFilter}`), { filter: selectedFilter });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply filter");
    } finally {
      stopProcessing();
    }
  }, [file, selectedFilter, startProcessing, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      download();
    },
    [download],
  );

  const handleStartOver = useCallback(() => {
    revokePreview();
    revokeLivePreview();
    setFile(null);
    setPixelPreviews({});
    clearResult();
    setSelectedFilter(null);
  }, [revokePreview, revokeLivePreview, clearResult]);

  const handleFilterSelect = useCallback((filter: FilterType) => setSelectedFilter(filter), []);
  const handleClearFilter = useCallback(() => setSelectedFilter(null), []);

  const previewSrc = useMemo(
    () => (isPixelBased && livePreview ? livePreview : preview),
    [isPixelBased, livePreview, preview],
  );
  const filterLabel = useMemo(
    () => (selectedFilter ? selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1) : ""),
    [selectedFilter],
  );

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
          onCopy={() => copyImageToClipboard(result.blob)}
          onStartOver={handleStartOver}
          startOverLabel="Apply to Another"
        >
          <p className="text-muted-foreground">
            {result.metadata?.filter
              ? result.metadata.filter.charAt(0).toUpperCase() + result.metadata.filter.slice(1)
              : ""}{" "}
            filter • {formatFileSize(result.blob.size)}
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
        <div className="grid md:grid-cols-2 gap-6 overflow-hidden">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px] overflow-hidden">
              <img
                src={previewSrc || ""}
                alt="Preview"
                style={currentFilterStyle}
                className="max-h-[180px] max-w-full object-contain transition-all duration-200"
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file.name} • {formatFileSize(file.size)}
            </p>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Select Filter</span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {filters.map((filter) => (
                  <button
                    type="button"
                    key={filter.value}
                    onClick={() => handleFilterSelect(filter.value)}
                    className={`relative overflow-hidden border-2 border-foreground aspect-square transition-all ${selectedFilter === filter.value ? "ring-2 ring-offset-1 ring-foreground" : "hover:scale-[1.03]"}`}
                  >
                    <img
                      src={filter.pixelBased && pixelPreviews[filter.value] ? pixelPreviews[filter.value] : preview!}
                      alt={filter.label}
                      style={filter.pixelBased ? {} : { filter: filter.cssFilter }}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-foreground/90 py-0.5">
                      <span className="text-[10px] font-bold text-background">{filter.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {selectedFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear filter selection
              </button>
            )}
            {error && <ErrorBox message={error} />}
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !selectedFilter}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <FiltersIcon className="w-5 h-5" />
                  {selectedFilter ? `Apply ${filterLabel}` : "Select a Filter"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

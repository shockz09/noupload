"use client";

import { useCallback, useRef, useState } from "react";
import { CopyIcon, TrashIcon } from "@/components/icons/ui";
import { ImageIcon, PaletteIcon } from "@/components/icons/image";
import { ErrorBox, ImageFileInfo, ImagePageHeader, ProgressBar } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useFileProcessing, useImagePaste, useObjectURL } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { extractColorPalette, formatFileSize } from "@/lib/image-utils";

// Eyedropper icon component
function EyedropperIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </svg>
  );
}

interface PickedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  id: string;
}

export default function ColorPalettePage() {
  const [file, setFile] = useState<File | null>(null);
  const [colors, setColors] = useState<PickedColor[]>([]);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        setColors([]);
        setPreview(selectedFile);
        clearError();
      }
    },
    [setPreview, clearError],
  );

  useImagePaste(handleFileSelected, colors.length === 0 && !file);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setColors([]);
    setHoveredColor(null);
  }, [revokePreview]);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    // Draw image to hidden canvas for color sampling
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
    }
  }, []);

  const getColorFromCoords = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    return { hex, rgb: { r, g, b } };
  }, []);

  const getColorAtPosition = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return null;

      const rect = img.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

      return getColorFromCoords(x, y);
    },
    [getColorFromCoords],
  );

  const getColorAtHoverPosition = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return null;

      const rect = img.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

      return getColorFromCoords(x, y);
    },
    [getColorFromCoords],
  );

  const pickCenterColor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = canvas.width / 2;
    const y = canvas.height / 2;
    const color = getColorFromCoords(x, y);

    if (color) {
      // Check if color already exists
      const exists = colors.some((c) => c.hex.toLowerCase() === color.hex.toLowerCase());
      if (!exists) {
        setColors((prev) => [...prev, { ...color, id: crypto.randomUUID() }]);
      }
    }
  }, [getColorFromCoords, colors]);

  const handleImageHover = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const color = getColorAtHoverPosition(e);
      if (color) {
        setHoveredColor(color.hex);
      }
    },
    [getColorAtHoverPosition],
  );

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const color = getColorAtPosition(e);
      if (color) {
        // Check if color already exists
        const exists = colors.some((c) => c.hex.toLowerCase() === color.hex.toLowerCase());
        if (!exists) {
          setColors((prev) => [...prev, { ...color, id: crypto.randomUUID() }]);
        }
      }
    },
    [getColorAtPosition, colors],
  );

  const handleImageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pickCenterColor();
      }
    },
    [pickCenterColor],
  );

  const handleAutoExtract = useCallback(async () => {
    if (!file || !startProcessing()) return;

    try {
      setProgress(30);
      const extractedColors = await extractColorPalette(file, 6);
      setProgress(100);

      // Convert to PickedColor format and add to existing colors
      const newColors: PickedColor[] = extractedColors.map((c) => ({
        hex: c.hex,
        rgb: c.rgb,
        id: crypto.randomUUID(),
      }));

      // Filter out duplicates
      const existingHexes = new Set(colors.map((c) => c.hex.toLowerCase()));
      const uniqueNewColors = newColors.filter((c) => !existingHexes.has(c.hex.toLowerCase()));

      setColors((prev) => [...prev, ...uniqueNewColors]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to extract colors"));
    } finally {
      stopProcessing();
    }
  }, [file, startProcessing, setProgress, setError, stopProcessing, colors]);

  const handleRemoveColor = useCallback((id: string) => {
    setColors((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleClearPalette = useCallback(() => {
    setColors([]);
  }, []);

  const handleCopyColor = useCallback(async (color: PickedColor) => {
    try {
      await navigator.clipboard.writeText(color.hex.toUpperCase());
      setCopiedId(color.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard might not be available
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    try {
      const colorList = colors.map((c) => c.hex.toUpperCase()).join("\n");
      await navigator.clipboard.writeText(colorList);
    } catch {
      // Clipboard might not be available
    }
  }, [colors]);

  const handleCopyCSS = useCallback(async () => {
    try {
      const cssVars = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join("\n");
      const css = `:root {\n${cssVars}\n}`;
      await navigator.clipboard.writeText(css);
    } catch {
      // Clipboard might not be available
    }
  }, [colors]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<PaletteIcon className="w-7 h-7" />}
        iconClass="tool-palette"
        title="Color Palette"
        description="Pick colors from any image"
      />

      {!file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your image here"
            subtitle="or click to browse · Ctrl+V to paste"
          />
          <InfoBox title="Pick Any Color" icon={<EyedropperIcon className="w-5 h-5 mt-0.5" />}>
            Click anywhere on your image to sample colors. Build your own palette or auto-extract dominant colors.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          {/* Hidden canvas for color sampling */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Main image - clickable for color picking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Click on the image to pick colors</span>
              {hoveredColor && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border border-foreground" style={{ backgroundColor: hoveredColor }} />
                  <span className="font-mono text-sm font-bold">{hoveredColor.toUpperCase()}</span>
                </div>
              )}
            </div>

            <div className="relative border-2 border-foreground overflow-hidden bg-muted/20">
              {preview && (
                <button
                  type="button"
                  onClick={handleImageClick}
                  onMouseMove={handleImageHover}
                  onMouseLeave={() => setHoveredColor(null)}
                  onKeyDown={handleImageKeyDown}
                  className="w-full p-0 border-0 bg-transparent cursor-crosshair"
                  aria-label="Click to pick color from image"
                >
                  <img
                    ref={imageRef}
                    src={preview}
                    alt="Color picker source"
                    className="w-full max-h-[400px] object-contain pointer-events-none"
                    onLoad={handleImageLoad}
                    draggable={false}
                  />
                </button>
              )}
            </div>

            <button type="button" onClick={handleAutoExtract} disabled={isProcessing} className="btn-secondary w-full">
              <PaletteIcon className="w-4 h-4" />
              Auto-Extract Dominant Colors
            </button>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Extracting colors..." />}

          {/* Picked colors palette */}
          {colors.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">Your Palette ({colors.length} colors)</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCopyCSS}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copy CSS
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copy All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearPalette}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Color swatches row */}
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <div key={color.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleCopyColor(color)}
                      className="w-12 h-12 border-2 border-foreground transition-transform hover:scale-110"
                      style={{ backgroundColor: color.hex }}
                      title={`Click to copy ${color.hex.toUpperCase()}`}
                    >
                      {copiedId === color.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <span className="text-white text-[10px] font-bold">Copied!</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color.id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove color"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden="true"
                      >
                        <title>Remove</title>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Color list with details */}
              <div className="space-y-2">
                {colors.map((color) => (
                  <div
                    key={color.id}
                    className="flex items-center gap-3 p-2 border-2 border-foreground bg-background group"
                  >
                    <div className="w-8 h-8 border border-foreground shrink-0" style={{ backgroundColor: color.hex }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-sm">{color.hex.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        RGB({color.rgb.r}, {color.rgb.g}, {color.rgb.b})
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyColor(color)}
                        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                        title="Copy color"
                      >
                        <CopyIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(color.id)}
                        className="text-muted-foreground hover:text-red-500 p-1 transition-colors"
                        title="Remove color"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {colors.length === 0 && !isProcessing && (
            <div className="text-center py-8 text-muted-foreground">
              <EyedropperIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click on the image to start picking colors</p>
              <p className="text-xs mt-1">or use Auto-Extract for dominant colors</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

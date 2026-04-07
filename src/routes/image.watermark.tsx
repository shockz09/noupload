import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/image/watermark")({
	head: () => ({
		meta: [
			{ title: "Add Watermark to Image Free - Text & Logo Watermarks | noupload" },
			{ name: "description", content: "Add watermarks to images for free. Text or image watermarks with custom position, opacity, and size. Works offline, completely private." },
			{ name: "keywords", content: "image watermark, add watermark, photo watermark, watermark generator, logo watermark, free watermark tool" },
			{ property: "og:title", content: "Add Watermark to Image Free - Text & Logo Watermarks" },
			{ property: "og:description", content: "Add watermarks to images for free. Works 100% offline." },
		],
	}),
	component: ImageWatermarkPage,
});

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { WatermarkIcon } from "@/components/icons/pdf";
import { ErrorBox, ImagePageHeader, ImageResultView } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileBuffer, useFileProcessing, useImagePaste, useObjectURL, useProcessingResult } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { addWatermark, copyImageToClipboard, formatFileSize, getImageDimensions, getOutputFilename } from "@/lib/image-utils";

const opacityPresets = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

const colorPresets = ["#000000", "#FFFFFF", "#ef4444", "#3b82f6", "#22c55e", "#eab308"];

function ImageWatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [text, setText] = useState("© Your Name");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(100);
  const [color, setColor] = useState("#000000");

  // Watermark position as fraction of image (0–1)
  const [wmX, setWmX] = useState(0.5);
  const [wmY, setWmY] = useState(0.5);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ mx: 0, my: 0, startX: 0, startY: 0, startFontSize: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useProcessingResult();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      clearResult();
      setPreview(f);
      const dims = await getImageDimensions(f);
      setImageDims(dims);
      // Default font size ~5% of image width
      setFontSize(Math.round(Math.max(20, dims.width * 0.05)));
    },
    [clearResult, setPreview],
  );

  useImagePaste(handleFileSelected, !result);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setImageDims(null);
    clearResult();
  }, [revokePreview, clearResult]);

  const handleApply = useCallback(async () => {
    if (!file || !text.trim()) return;
    if (!startProcessing()) return;

    try {
      const watermarked = await addWatermark(file, {
        text: text.trim(),
        fontSize,
        opacity: opacity / 100,
        x: wmX,
        y: wmY,
        color,
      });
      setResult(watermarked, getOutputFilename(file.name, undefined, "_watermarked"));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add watermark"));
    } finally {
      stopProcessing();
    }
  }, [file, text, fontSize, opacity, wmX, wmY, color, startProcessing, setResult, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      download();
    },
    [download],
  );

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: result.blob.type,
      size: result.blob.size,
      fileType: "image",
      sourceToolLabel: "Add Watermark",
    });
  }, [result, addToBuffer]);

  const beginInteraction = useCallback((e: React.MouseEvent, mode: "drag" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    dragStartRef.current = { mx: e.clientX, my: e.clientY, startX: wmX, startY: wmY, startFontSize: fontSize };
    if (mode === "drag") setIsDragging(true);
    else setIsResizing(true);
  }, [wmX, wmY, fontSize]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const container = previewRef.current;
    if (!container) return;

    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const { mx, my, startX, startY, startFontSize } = dragStartRef.current;

      if (isDragging) {
        const dx = (e.clientX - mx) / rect.width;
        const dy = (e.clientY - my) / rect.height;
        setWmX(Math.max(0, Math.min(1, startX + dx)));
        setWmY(Math.max(0, Math.min(1, startY + dy)));
      } else if (isResizing) {
        // Horizontal drag distance controls font size
        const dx = e.clientX - mx;
        const scale = dx / rect.width;
        setFontSize(Math.max(12, Math.round(startFontSize + startFontSize * scale * 2)));
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging, isResizing]);

  // Track preview scale for font size mapping
  const [previewScale, setPreviewScale] = useState(1);

  // Update scale when image loads or window resizes
  useEffect(() => {
    if (!imageDims || !previewRef.current) return;
    const update = () => {
      if (previewRef.current) {
        setPreviewScale(previewRef.current.clientWidth / imageDims.width);
      }
    };
    // Run after img renders
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [imageDims, preview]);

  const previewFontSize = Math.max(8, fontSize * previewScale);

  return (
    <div className="page-enter max-w-4xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<WatermarkIcon className="w-7 h-7" />}
        iconClass="tool-image-watermark"
        title="Add Watermark"
        description="Add text watermarks to your images"
      />

      {result ? (
        <ImageResultView
          blob={result.blob}
          title="Watermark Added!"
          downloadLabel="Download Image"
          onDownload={handleDownload}
          onCopy={() => copyImageToClipboard(result.blob)}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleClear}
          startOverLabel="Watermark Another"
        />
      ) : !file ? (
        <div className="max-w-2xl mx-auto">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your image here"
            subtitle="or click to browse · Ctrl+V to paste"
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_auto] gap-6">
          {/* Left: Preview with draggable watermark */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Drag to position · corner handle to resize
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Change file
              </button>
            </div>
            <div className="border-2 border-foreground bg-muted/30 flex justify-center items-center overflow-hidden">
              {preview && (
                <div ref={previewRef} className="relative inline-block select-none overflow-hidden" style={{ cursor: "default" }}>
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-[400px] w-auto block"
                    draggable={false}
                    decoding="async"
                  />
                  {/* Draggable watermark text */}
                  {text && (
                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => beginInteraction(e, "drag")}
                      className="absolute select-none"
                      style={{
                        left: `${wmX * 100}%`,
                        top: `${wmY * 100}%`,
                        fontSize: `${previewFontSize}px`,
                        color,
                        opacity: opacity / 100,
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        cursor: isDragging ? "grabbing" : "grab",
                        textShadow:
                          color === "#FFFFFF" || color === "#f5f5f5"
                            ? "0 1px 3px rgba(0,0,0,0.4)"
                            : "0 1px 3px rgba(255,255,255,0.3)",
                        border: "1px dashed rgba(128,128,128,0.5)",
                        padding: "2px 4px",
                        userSelect: "none",
                      }}
                    >
                      {text}
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => beginInteraction(e, "resize")}
                        className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-foreground border border-background cursor-se-resize"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {file.name} • {formatFileSize(file.size)}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4 md:w-56">
            {/* Text Input */}
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Text</span>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Watermark text"
                className="w-full px-3 py-2 text-sm border-2 border-foreground/30 focus:border-foreground outline-none bg-background"
              />
            </div>

            {/* Opacity Presets */}
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Opacity</span>
              <div className="flex gap-1">
                {opacityPresets.map((op) => (
                  <button
                    type="button"
                    key={op.value}
                    onClick={() => setOpacity(op.value)}
                    className={`flex-1 py-1.5 text-xs font-bold border-2 transition-all ${
                      opacity === op.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Chips */}
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Color</span>
              <div className="flex gap-1.5">
                {colorPresets.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-sm border-2 transition-all ${
                      color === c
                        ? "border-foreground scale-110"
                        : "border-foreground/30 hover:border-foreground/60"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {error && <ErrorBox message={error} />}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !text.trim()}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <WatermarkIcon className="w-5 h-5" />
                  Add Watermark
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

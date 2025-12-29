"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toPng } from "html-to-image";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { gradientPresets, solidPresets } from "@/lib/gradient-presets";
import { ScreenshotIcon, DownloadIcon, LoaderIcon } from "@/components/icons";
import { ImagePageHeader } from "@/components/image/shared";

export default function ScreenshotBeautifierPage() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [background, setBackground] = useState(gradientPresets[0].css);
  const [padding, setPadding] = useState(48);
  const [borderRadius, setBorderRadius] = useState(12);
  const [shadow, setShadow] = useState(true);
  const [windowChrome, setWindowChrome] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setFileName(file.name);
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      setExported(false);
    }
  }, []);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setFileName("pasted-image.png");
            const dataUrl = await fileToDataUrl(file);
            setImage(dataUrl);
            setExported(false);
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleExport = async () => {
    if (!canvasRef.current) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `${fileName.replace(/\.[^.]+$/, "") || "screenshot"}_beautified.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExported(true);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Try a different image or refresh the page.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartOver = () => {
    setImage(null);
    setFileName("");
    setExported(false);
  };

  return (
    <div className="page-enter max-w-3xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<ScreenshotIcon className="w-7 h-7" />}
        iconClass="tool-screenshot"
        title="Screenshot Beautifier"
        description="Add backgrounds and frames to your screenshots"
      />

      {!image ? (
        <FileDropzone
          accept=".jpg,.jpeg,.png,.webp,.gif"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your screenshot here"
          subtitle="or click to browse · Ctrl+V to paste"
        />
      ) : (
        <div className="space-y-6">
          <div className="border-2 border-foreground overflow-auto max-h-[500px]">
            <div
              ref={canvasRef}
              style={{ background, padding: `${padding}px`, display: "inline-block" }}
            >
              {windowChrome && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    background: "#e8e8e8",
                    borderTopLeftRadius: `${borderRadius}px`,
                    borderTopRightRadius: `${borderRadius}px`,
                  }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
                </div>
              )}
              <img
                src={image}
                alt="Screenshot"
                style={{
                  display: "block",
                  borderRadius: windowChrome ? `0 0 ${borderRadius}px ${borderRadius}px` : `${borderRadius}px`,
                  boxShadow: shadow
                    ? "0 4px 6px -1px rgba(0,0,0,0.1), 0 20px 25px -5px rgba(0,0,0,0.15), 0 45px 60px -15px rgba(0,0,0,0.2)"
                    : "none",
                }}
              />
            </div>
          </div>

          <div className="p-4 bg-card border-2 border-foreground space-y-3">
            <label className="input-label">Background</label>
            <div className="flex flex-wrap gap-2">
              {gradientPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setBackground(preset.css)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    background === preset.css
                      ? "border-foreground ring-2 ring-primary ring-offset-1"
                      : "border-foreground/30 hover:border-foreground"
                  }`}
                  style={{ background: preset.css }}
                  title={preset.name}
                />
              ))}
              <div className="w-px h-8 bg-foreground/20 mx-1" />
              {solidPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setBackground(preset.css)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    background === preset.css
                      ? "border-foreground ring-2 ring-primary ring-offset-1"
                      : "border-foreground/30 hover:border-foreground"
                  }`}
                  style={{ background: preset.css }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-card border-2 border-foreground space-y-4">
            <label className="input-label">Frame</label>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Padding</span>
                  <span className="font-bold text-xs bg-muted px-2 py-0.5">{padding}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="96"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Corners</span>
                  <span className="font-bold text-xs bg-muted px-2 py-0.5">{borderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                  className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shadow}
                  onChange={(e) => setShadow(e.target.checked)}
                  className="w-4 h-4 border-2 border-foreground bg-white checked:bg-primary appearance-none cursor-pointer relative checked:after:content-[''] checked:after:absolute checked:after:left-1 checked:after:top-0 checked:after:w-1.5 checked:after:h-2.5 checked:after:border-white checked:after:border-r-2 checked:after:border-b-2 checked:after:rotate-45"
                />
                <span className="text-sm font-medium">Shadow</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={windowChrome}
                  onChange={(e) => setWindowChrome(e.target.checked)}
                  className="w-4 h-4 border-2 border-foreground bg-white checked:bg-primary appearance-none cursor-pointer relative checked:after:content-[''] checked:after:absolute checked:after:left-1 checked:after:top-0 checked:after:w-1.5 checked:after:h-2.5 checked:after:border-white checked:after:border-r-2 checked:after:border-b-2 checked:after:rotate-45"
                />
                <span className="text-sm font-medium">Window buttons</span>
              </label>

              <button
                onClick={handleStartOver}
                className="ml-auto text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Change image
              </button>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className={exported ? "btn-success w-full" : "btn-primary w-full"}
          >
            {isExporting ? (
              <><LoaderIcon className="w-5 h-5" />Exporting...</>
            ) : exported ? (
              <><DownloadIcon className="w-5 h-5" />Download Again</>
            ) : (
              <><DownloadIcon className="w-5 h-5" />Download PNG</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

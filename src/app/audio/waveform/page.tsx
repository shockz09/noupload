"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioPageHeader, ErrorBox } from "@/components/audio/shared";
import { AudioIcon, DownloadIcon, LoaderIcon, WaveformIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useFileProcessing } from "@/hooks";
import {
  formatDuration,
  formatFileSize,
  generateWaveformImage,
  getAudioInfo,
  getWaveformData,
} from "@/lib/audio-utils";
import { getFileBaseName } from "@/lib/utils";

// Waveform color presets
const waveformColors = [
  { name: "Coral", color: "#C84C1C" },
  { name: "Crimson", color: "#DC2626" },
  { name: "Orange", color: "#EA580C" },
  { name: "Amber", color: "#D97706" },
  { name: "Emerald", color: "#059669" },
  { name: "Teal", color: "#0D9488" },
  { name: "Sky", color: "#0284C7" },
  { name: "Blue", color: "#2563EB" },
  { name: "Violet", color: "#7C3AED" },
  { name: "Pink", color: "#DB2777" },
  { name: "Slate", color: "#475569" },
  { name: "Black", color: "#1A1A1A" },
];

// Background presets
const backgroundColors = [
  { name: "Paper", color: "#FAF7F2" },
  { name: "White", color: "#FFFFFF" },
  { name: "Cream", color: "#FFFBEB" },
  { name: "Mint", color: "#ECFDF5" },
  { name: "Sky", color: "#F0F9FF" },
  { name: "Lavender", color: "#FAF5FF" },
  { name: "Rose", color: "#FFF1F2" },
  { name: "Slate", color: "#F1F5F9" },
  { name: "Stone", color: "#E7E5E4" },
  { name: "Charcoal", color: "#27272A" },
  { name: "Dark", color: "#18181B" },
  { name: "Black", color: "#09090B" },
];

// Export size presets
const exportSizes = [
  { name: "Social", width: 1200, height: 630, label: "1200×630" },
  { name: "Wide", width: 1920, height: 400, label: "1920×400" },
  { name: "Square", width: 1080, height: 1080, label: "1080×1080" },
  { name: "Banner", width: 1500, height: 500, label: "1500×500" },
];

export default function WaveformPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [waveformColor, setWaveformColor] = useState(waveformColors[1].color);
  const [bgColor, setBgColor] = useState(backgroundColors[11].color);
  const [exportSize, setExportSize] = useState(exportSizes[0]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use custom hooks
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();

  // Draw waveform to canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d")!;
    const width = canvas.width;
    const height = canvas.height;

    // Clear and draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform bars
    ctx.fillStyle = waveformColor;
    const centerY = height / 2;
    const maxHeight = height * 0.8;
    const barWidth = width / waveformData.length;

    for (let i = 0; i < waveformData.length; i++) {
      const barHeight = waveformData[i] * maxHeight;
      const x = i * barWidth;
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(1, barWidth - 1), barHeight);
    }
  }, [waveformData, waveformColor, bgColor]);

  // Redraw when colors change
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        setIsLoadingPreview(true);

        try {
          const [info, data] = await Promise.all([getAudioInfo(selectedFile), getWaveformData(selectedFile, 200)]);
          setDuration(info.duration);
          setWaveformData(data);
        } catch {
          setError("Failed to load audio file.");
        } finally {
          setIsLoadingPreview(false);
        }
      }
    },
    [setError],
  );

  const handleExport = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const blob = await generateWaveformImage(file, exportSize.width, exportSize.height, waveformColor, bgColor);

      const baseName = getFileBaseName(file.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_waveform.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate waveform");
    } finally {
      stopProcessing();
    }
  }, [file, exportSize, waveformColor, bgColor, startProcessing, setError, stopProcessing]);

  const handleStartOver = useCallback(() => {
    setFile(null);
    setWaveformData([]);
  }, []);

  const handleWaveformColorSelect = useCallback((color: string) => setWaveformColor(color), []);
  const handleBgColorSelect = useCallback((color: string) => setBgColor(color), []);
  const handleExportSizeSelect = useCallback((size: (typeof exportSizes)[0]) => setExportSize(size), []);

  const isExportDisabled = useMemo(
    () => isProcessing || waveformData.length === 0,
    [isProcessing, waveformData.length],
  );

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<WaveformIcon className="w-7 h-7" />}
        iconClass="tool-audio-waveform"
        title="Waveform Image"
        description="Generate beautiful waveform visualizations"
      />

      {!file ? (
        <FileDropzone
          accept=".mp3,.wav,.ogg,.m4a,.webm"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio file here"
          subtitle="MP3, WAV, OGG, M4A, WebM"
        />
      ) : (
        <div className="space-y-4">
          {/* File Info - Compact */}
          <div className="flex items-center gap-3 p-3 border-2 border-foreground bg-card">
            <AudioIcon className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(duration)} • {formatFileSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartOver}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>

          {/* Live Preview - Compact */}
          <div className="border-2 border-foreground p-2 bg-muted/30">
            {isLoadingPreview ? (
              <div className="h-[80px] flex items-center justify-center gap-2 text-muted-foreground">
                <LoaderIcon className="w-4 h-4" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <canvas ref={canvasRef} width={600} height={80} className="w-full h-auto" />
            )}
          </div>

          {/* Controls - Compact Grid */}
          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            {/* Colors Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Waveform Color */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Wave</span>
                <div className="flex flex-wrap gap-1">
                  {waveformColors.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => handleWaveformColorSelect(preset.color)}
                      className={`w-6 h-6 border-2 transition-all ${
                        waveformColor === preset.color
                          ? "border-foreground ring-2 ring-offset-1 ring-foreground"
                          : "border-transparent hover:border-foreground/50"
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Background</span>
                <div className="flex flex-wrap gap-1">
                  {backgroundColors.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => handleBgColorSelect(preset.color)}
                      className={`w-6 h-6 border transition-all ${
                        bgColor === preset.color
                          ? "border-foreground ring-2 ring-offset-1 ring-foreground"
                          : "border-foreground/20 hover:border-foreground/50"
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Export Size - Inline */}
            <div className="flex items-center gap-2 pt-2 border-t border-foreground/10">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground shrink-0">Size</span>
              <div className="flex gap-1 flex-1">
                {exportSizes.map((size) => (
                  <button
                    type="button"
                    key={size.name}
                    onClick={() => handleExportSizeSelect(size)}
                    className={`px-2 py-1 text-xs font-bold border-2 transition-all ${
                      exportSize.name === size.name
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    {size.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {/* Export Button */}
          <button type="button" onClick={handleExport} disabled={isExportDisabled} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Exporting...
              </>
            ) : (
              <>
                <DownloadIcon className="w-5 h-5" />
                Export PNG
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

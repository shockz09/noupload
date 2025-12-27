"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { generateWaveformImage, formatDuration, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { ArrowLeftIcon, DownloadIcon, LoaderIcon } from "@/components/icons";

function WaveformIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12h2l2-7 3 14 3-7 2 3h8" />
    </svg>
  );
}

function AudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}

const colorPresets = [
  { name: "Orange", waveform: "#C84C1C", bg: "#FAF7F2" },
  { name: "Blue", waveform: "#2563EB", bg: "#F8FAFC" },
  { name: "Green", waveform: "#16A34A", bg: "#F0FDF4" },
  { name: "Purple", waveform: "#7C3AED", bg: "#FAF5FF" },
  { name: "Dark", waveform: "#FFFFFF", bg: "#1A1A1A" },
];

export default function WaveformPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [selectedColor, setSelectedColor] = useState(colorPresets[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  useEffect(() => {
    return () => { if (result) URL.revokeObjectURL(result); };
  }, [result]);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      try {
        const info = await getAudioInfo(selectedFile);
        setDuration(info.duration);
      } catch {
        setError("Failed to load audio file.");
      }
    }
  }, []);

  const handleGenerate = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const blob = await generateWaveformImage(file, 800, 200, selectedColor.waveform, selectedColor.bg);
      if (result) URL.revokeObjectURL(result);
      setResult(URL.createObjectURL(blob));
      setResultBlob(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate waveform");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (resultBlob && file) {
      const baseName = file.name.split(".").slice(0, -1).join(".");
      const url = URL.createObjectURL(resultBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_waveform.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleStartOver = () => {
    if (result) URL.revokeObjectURL(result);
    setFile(null);
    setResult(null);
    setResultBlob(null);
    setError(null);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <div className="space-y-6">
        <Link href="/audio" className="back-link"><ArrowLeftIcon className="w-4 h-4" />Back to Audio Tools</Link>
        <div className="flex items-center gap-5">
          <div className="tool-icon tool-audio-waveform"><WaveformIcon className="w-7 h-7" /></div>
          <div>
            <h1 className="text-4xl font-display">Waveform Image</h1>
            <p className="text-muted-foreground mt-1">Generate waveform image from audio</p>
          </div>
        </div>
      </div>

      {result ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp"><span className="success-stamp-text">Generated</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Waveform Generated!</h2>
            </div>
            <img src={result} alt="Waveform" className="w-full border-2 border-foreground mb-6" />
            <button onClick={handleDownload} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />Download Image
            </button>
          </div>
          <button onClick={handleStartOver} className="btn-secondary w-full">Generate Another</button>
        </div>
      ) : !file ? (
        <FileDropzone accept=".mp3,.wav,.ogg,.m4a,.webm" multiple={false} onFilesSelected={handleFileSelected}
          title="Drop your audio file here" subtitle="MP3, WAV, OGG, M4A, WebM" />
      ) : (
        <div className="space-y-6">
          <div className="file-item">
            <div className="pdf-icon-box"><AudioIcon className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatDuration(duration)} • {formatFileSize(file.size)}</p>
            </div>
            <button onClick={handleStartOver} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Change</button>
          </div>

          <div className="space-y-3">
            <label className="input-label">Color Theme</label>
            <div className="grid grid-cols-5 gap-2">
              {colorPresets.map((preset) => (
                <button key={preset.name} onClick={() => setSelectedColor(preset)}
                  className={`p-3 border-2 transition-colors ${selectedColor.name === preset.name ? "border-foreground" : "border-muted hover:border-foreground"}`}
                  style={{ backgroundColor: preset.bg }}>
                  <div className="h-4 rounded" style={{ backgroundColor: preset.waveform }} />
                  <p className="text-xs mt-1 font-medium" style={{ color: preset.name === "Dark" ? "#fff" : "#1a1a1a" }}>{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-box animate-shake">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <button onClick={handleGenerate} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? <><LoaderIcon className="w-5 h-5" />Generating...</> : <><WaveformIcon className="w-5 h-5" />Generate Waveform</>}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { changeSpeed, downloadAudio, formatDuration, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { ArrowLeftIcon, DownloadIcon, LoaderIcon } from "@/components/icons";

function SpeedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

const speedPresets = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function SpeedAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      try {
        const info = await getAudioInfo(selectedFile);
        setDuration(info.duration);
        const url = URL.createObjectURL(selectedFile);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(url);
      } catch {
        setError("Failed to load audio file.");
      }
    }
  }, [audioUrl]);

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const processed = await changeSpeed(file, speed);
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change speed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result && file) {
      const baseName = file.name.split(".").slice(0, -1).join(".");
      downloadAudio(result, `${baseName}_${speed}x.wav`);
    }
  };

  const handleStartOver = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setResult(null);
    setError(null);
    setSpeed(1);
  };

  const newDuration = duration / speed;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <div className="space-y-6">
        <Link href="/audio" className="back-link"><ArrowLeftIcon className="w-4 h-4" />Back to Audio Tools</Link>
        <div className="flex items-center gap-5">
          <div className="tool-icon tool-audio-speed"><SpeedIcon className="w-7 h-7" /></div>
          <div>
            <h1 className="text-4xl font-display">Change Speed</h1>
            <p className="text-muted-foreground mt-1">Speed up or slow down audio</p>
          </div>
        </div>
      </div>

      {result ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp"><span className="success-stamp-text">Done</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Speed Changed!</h2>
              <p className="text-muted-foreground">{speed}x speed • {formatDuration(newDuration)} • {formatFileSize(result.size)}</p>
            </div>
            <button onClick={handleDownload} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />Download Audio
            </button>
          </div>
          <button onClick={handleStartOver} className="btn-secondary w-full">Process Another</button>
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

          {audioUrl && <audio controls src={audioUrl} className="w-full" />}

          <div className="space-y-3">
            <label className="input-label">Speed</label>
            <div className="grid grid-cols-6 gap-2">
              {speedPresets.map((s) => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-3 py-2 text-sm font-bold border-2 border-foreground transition-colors ${speed === s ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="bg-muted/50 border-2 border-foreground p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original duration:</span>
              <span className="font-bold">{formatDuration(duration)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">New duration:</span>
              <span className="font-bold">{formatDuration(newDuration)}</span>
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

          <button onClick={handleProcess} disabled={isProcessing || speed === 1} className="btn-primary w-full">
            {isProcessing ? <><LoaderIcon className="w-5 h-5" />Processing...</> : <><SpeedIcon className="w-5 h-5" />Change Speed to {speed}x</>}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { applyFade, downloadAudio, formatDuration, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { ArrowLeftIcon, DownloadIcon, LoaderIcon } from "@/components/icons";

function FadeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12h4l3-9 6 18 3-9h4" />
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

export default function FadeAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [fadeIn, setFadeIn] = useState(1);
  const [fadeOut, setFadeOut] = useState(1);
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
      const processed = await applyFade(file, fadeIn, fadeOut);
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply fade");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result && file) {
      const baseName = file.name.split(".").slice(0, -1).join(".");
      downloadAudio(result, `${baseName}_fade.wav`);
    }
  };

  const handleStartOver = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setResult(null);
    setError(null);
    setFadeIn(1);
    setFadeOut(1);
  };

  const maxFade = Math.min(duration / 2, 10);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <div className="space-y-6">
        <Link href="/audio" className="back-link"><ArrowLeftIcon className="w-4 h-4" />Back to Audio Tools</Link>
        <div className="flex items-center gap-5">
          <div className="tool-icon tool-audio-fade"><FadeIcon className="w-7 h-7" /></div>
          <div>
            <h1 className="text-4xl font-display">Fade Effect</h1>
            <p className="text-muted-foreground mt-1">Add fade in and fade out effects</p>
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
              <h2 className="text-3xl font-display">Fade Applied!</h2>
              <p className="text-muted-foreground">Fade in: {fadeIn}s • Fade out: {fadeOut}s • {formatFileSize(result.size)}</p>
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

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="input-label">Fade In Duration</label>
                <span className="text-sm font-bold">{fadeIn}s</span>
              </div>
              <input type="range" min="0" max={maxFade} step="0.1" value={fadeIn} onChange={(e) => setFadeIn(Number(e.target.value))}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="input-label">Fade Out Duration</label>
                <span className="text-sm font-bold">{fadeOut}s</span>
              </div>
              <input type="range" min="0" max={maxFade} step="0.1" value={fadeOut} onChange={(e) => setFadeOut(Number(e.target.value))}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer" />
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

          <button onClick={handleProcess} disabled={isProcessing || (fadeIn === 0 && fadeOut === 0)} className="btn-primary w-full">
            {isProcessing ? <><LoaderIcon className="w-5 h-5" />Processing...</> : <><FadeIcon className="w-5 h-5" />Apply Fade</>}
          </button>
        </div>
      )}
    </div>
  );
}

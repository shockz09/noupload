"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  trimAudio,
  getAudioInfo,
  downloadAudio,
  formatDuration,
  formatFileSize,
  getWaveformData,
} from "@/lib/audio-utils";
import { ArrowLeftIcon, DownloadIcon, LoaderIcon } from "@/components/icons";

function TrimIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2v20M18 2v20M6 12h12" />
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

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export default function TrimAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
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
        setStartTime(0);
        setEndTime(info.duration);

        const waveformData = await getWaveformData(selectedFile, 200);
        setWaveform(waveformData);

        const url = URL.createObjectURL(selectedFile);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(url);
      } catch (err) {
        setError("Failed to load audio file. Please try a different format.");
      }
    }
  }, [audioUrl]);

  const handleClear = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setDuration(0);
    setWaveform([]);
    setError(null);
    setResult(null);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);

    // Stop at end time
    if (audioRef.current.currentTime >= endTime) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTrim = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const trimmed = await trimAudio(file, startTime, endTime);
      setResult(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trim audio");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result && file) {
      const baseName = file.name.split(".").slice(0, -1).join(".");
      downloadAudio(result, `${baseName}_trimmed.wav`);
    }
  };

  const handleStartOver = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setDuration(0);
    setWaveform([]);
    setResult(null);
    setError(null);
  };

  // Calculate selection percentages for visual display
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-6">
        <Link href="/audio" className="back-link">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Audio Tools
        </Link>

        <div className="flex items-center gap-5">
          <div className="tool-icon tool-audio-trim">
            <TrimIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-4xl font-display">Trim Audio</h1>
            <p className="text-muted-foreground mt-1">
              Cut audio to specific start and end time
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {result ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Trimmed</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Audio Trimmed!</h2>
              <p className="text-muted-foreground">
                Duration: {formatDuration(endTime - startTime)} • {formatFileSize(result.size)}
              </p>
            </div>

            <button onClick={handleDownload} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download Trimmed Audio
            </button>
          </div>

          <button onClick={handleStartOver} className="btn-secondary w-full">
            Trim Another Audio
          </button>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".mp3,.wav,.ogg,.m4a,.webm,.aac"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your audio file here"
            subtitle="MP3, WAV, OGG, M4A, WebM"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Audio element (hidden) */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* File Info */}
          <div className="file-item">
            <div className="pdf-icon-box">
              <AudioIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatDuration(duration)} • {formatFileSize(file.size)}
              </p>
            </div>
            <button
              onClick={handleClear}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Change file
            </button>
          </div>

          {/* Waveform with selection */}
          <div className="space-y-3">
            <label className="input-label">Select region to keep</label>
            <div className="relative border-2 border-foreground bg-muted/30 h-24">
              {/* Waveform bars */}
              <div className="absolute inset-0 flex items-center px-1">
                {waveform.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 mx-px bg-muted-foreground/30"
                    style={{ height: `${val * 80}%` }}
                  />
                ))}
              </div>

              {/* Selected region overlay */}
              <div
                className="absolute top-0 bottom-0 bg-primary/20 border-x-2 border-primary"
                style={{
                  left: `${startPercent}%`,
                  width: `${endPercent - startPercent}%`,
                }}
              />

              {/* Current time indicator */}
              {isPlaying && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                  style={{ left: `${currentPercent}%` }}
                />
              )}
            </div>

            {/* Play button */}
            <div className="flex justify-center">
              <button
                onClick={togglePlay}
                className="w-12 h-12 border-2 border-foreground flex items-center justify-center hover:bg-muted transition-colors"
              >
                {isPlaying ? (
                  <PauseIcon className="w-5 h-5" />
                ) : (
                  <PlayIcon className="w-5 h-5 ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="input-label">Start Time</label>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={startTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setStartTime(Math.min(val, endTime - 0.1));
                }}
                className="w-full"
              />
              <p className="text-sm font-mono text-center">{formatDuration(startTime)}</p>
            </div>
            <div className="space-y-2">
              <label className="input-label">End Time</label>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={endTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEndTime(Math.max(val, startTime + 0.1));
                }}
                className="w-full"
              />
              <p className="text-sm font-mono text-center">{formatDuration(endTime)}</p>
            </div>
          </div>

          {/* Selection info */}
          <div className="bg-muted/50 border-2 border-foreground p-4 text-center">
            <p className="text-sm text-muted-foreground">Selected duration</p>
            <p className="text-2xl font-bold font-mono">
              {formatDuration(endTime - startTime)}
            </p>
          </div>

          {error && (
            <div className="error-box animate-shake">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <button
            onClick={handleTrim}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <LoaderIcon className="w-5 h-5" />
                Trimming...
              </>
            ) : (
              <>
                <TrimIcon className="w-5 h-5" />
                Trim Audio
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

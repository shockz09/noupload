"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  trimAudio,
  getAudioInfo,
  downloadAudio,
  formatDuration,
  formatFileSize,
  getWaveformData,
} from "@/lib/audio-utils";
import { TrimIcon, AudioIcon, PlayIcon, PauseIcon } from "@/components/icons";
import {
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioPageHeader,
} from "@/components/audio/shared";

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
      } catch {
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

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<TrimIcon className="w-7 h-7" />}
        iconClass="tool-audio-trim"
        title="Trim Audio"
        description="Cut audio to specific start and end time"
      />

      {result ? (
        <SuccessCard
          stampText="Trimmed"
          title="Audio Trimmed!"
          subtitle={`Duration: ${formatDuration(endTime - startTime)} • ${formatFileSize(result.size)}`}
          downloadLabel="Download Trimmed Audio"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Trim Another Audio"
        />
      ) : !file ? (
        <FileDropzone
          accept=".mp3,.wav,.ogg,.m4a,.webm,.aac"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio file here"
          subtitle="MP3, WAV, OGG, M4A, WebM"
        />
      ) : (
        <div className="space-y-6">
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

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleTrim}
            isProcessing={isProcessing}
            processingLabel="Trimming..."
            icon={<TrimIcon className="w-5 h-5" />}
            label="Trim Audio"
          />
        </div>
      )}
    </div>
  );
}

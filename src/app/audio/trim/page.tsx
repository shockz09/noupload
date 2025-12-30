"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  trimAudio,
  getAudioInfo,
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
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";

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
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();
  const [dragging, setDragging] = useState<"start" | "end" | "region" | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const loadIdRef = useRef(0); // Track current load operation to prevent race conditions

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleAudioReady = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      const currentLoadId = ++loadIdRef.current; // Increment and capture load ID

      setFile(selectedFile);
      setError(null);
      clearResult();

      try {
        const info = await getAudioInfo(selectedFile);
        // Check if this is still the current operation
        if (loadIdRef.current !== currentLoadId) return;

        setDuration(info.duration);
        setStartTime(0);
        setEndTime(info.duration);

        const waveformData = await getWaveformData(selectedFile, 200);
        // Check again after second async operation
        if (loadIdRef.current !== currentLoadId) return;

        setWaveform(waveformData);

        const url = URL.createObjectURL(selectedFile);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(url);
      } catch {
        // Only show error if this is still the current operation
        if (loadIdRef.current === currentLoadId) {
          setError("Failed to load audio file. Please try a different format.");
        }
      }
    }
  }, [audioUrl, clearResult]);

  const handleFileSelected = useCallback((files: File[]) => {
    processFileSelection(files, handleAudioReady);
  }, [processFileSelection, handleAudioReady]);

  const handleClear = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    clearResult();
    setFile(null);
    setAudioUrl(null);
    setDuration(0);
    setWaveform([]);
    setError(null);
  }, [audioUrl, clearResult]);

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
    clearResult();

    try {
      const trimmed = await trimAudio(file, startTime, endTime);
      const baseName = file.name.split(".").slice(0, -1).join(".");
      setResult(trimmed, `${baseName}_trimmed.wav`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trim audio");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOver = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    clearResult();
    setFile(null);
    setAudioUrl(null);
    setDuration(0);
    setWaveform([]);
    setError(null);
  };

  // Drag handling for waveform selection
  const getTimeFromEvent = (e: React.MouseEvent | MouseEvent) => {
    if (!waveformRef.current || duration === 0) return null;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  };

  const handleMouseDown = (type: "start" | "end" | "region") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(type);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromEvent(e);
      if (time === null) return;

      if (dragging === "start") {
        setStartTime(Math.max(0, Math.min(time, endTime - 0.1)));
      } else if (dragging === "end") {
        setEndTime(Math.min(duration, Math.max(time, startTime + 0.1)));
      } else if (dragging === "region") {
        // Move entire region - calculate based on initial grab point
        const regionDuration = endTime - startTime;
        const newStart = Math.max(0, Math.min(time - regionDuration / 2, duration - regionDuration));
        setStartTime(newStart);
        setEndTime(newStart + regionDuration);
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, startTime, endTime, duration]);

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
          subtitle={`Duration: ${formatDuration(endTime - startTime)} • ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Trimmed Audio"
          onDownload={download}
          onStartOver={handleStartOver}
          startOverLabel="Trim Another Audio"
        >
          <AudioPlayer src={result.url} />
        </SuccessCard>
      ) : isExtracting ? (
        <VideoExtractionProgress state={extractionState} progress={extractionProgress} filename={videoFilename} />
      ) : !file ? (
        <FileDropzone
          accept={AUDIO_VIDEO_EXTENSIONS}
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio or video file here"
          subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
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

          {/* Waveform with draggable selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="input-label">Drag handles to select region</label>
              <span className="text-sm font-mono text-muted-foreground">
                {formatDuration(startTime)} → {formatDuration(endTime)}
              </span>
            </div>
            <div
              ref={waveformRef}
              className={`relative border-2 border-foreground bg-muted/30 h-28 select-none ${dragging ? "cursor-grabbing" : ""}`}
            >
              {/* Waveform bars */}
              <div className="absolute inset-0 flex items-center px-1 pointer-events-none">
                {waveform.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 mx-px bg-muted-foreground/30"
                    style={{ height: `${val * 80}%` }}
                  />
                ))}
              </div>

              {/* Dimmed areas outside selection */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-foreground/40 pointer-events-none"
                style={{ width: `${startPercent}%` }}
              />
              <div
                className="absolute top-0 bottom-0 right-0 bg-foreground/40 pointer-events-none"
                style={{ width: `${100 - endPercent}%` }}
              />

              {/* Selected region (draggable to move) */}
              <div
                className={`absolute top-0 bottom-0 cursor-grab ${dragging === "region" ? "cursor-grabbing" : ""}`}
                style={{
                  left: `${startPercent}%`,
                  width: `${endPercent - startPercent}%`,
                }}
                onMouseDown={handleMouseDown("region")}
              />

              {/* Start handle */}
              <div
                className={`absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize hover:bg-primary/80 flex items-center justify-center ${dragging === "start" ? "bg-primary/80" : ""}`}
                style={{ left: `calc(${startPercent}% - 6px)` }}
                onMouseDown={handleMouseDown("start")}
              >
                <div className="w-0.5 h-8 bg-primary-foreground/50" />
              </div>

              {/* End handle */}
              <div
                className={`absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize hover:bg-primary/80 flex items-center justify-center ${dragging === "end" ? "bg-primary/80" : ""}`}
                style={{ left: `calc(${endPercent}% - 6px)` }}
                onMouseDown={handleMouseDown("end")}
              >
                <div className="w-0.5 h-8 bg-primary-foreground/50" />
              </div>

              {/* Current time indicator */}
              {isPlaying && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground pointer-events-none"
                  style={{ left: `${currentPercent}%` }}
                />
              )}
            </div>

            {/* Play button and selection info */}
            <div className="flex items-center justify-between">
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
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Selected duration</p>
                <p className="text-xl font-bold font-mono">{formatDuration(endTime - startTime)}</p>
              </div>
            </div>
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

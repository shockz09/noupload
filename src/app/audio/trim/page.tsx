"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
  AudioPageHeader,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { AudioIcon, PauseIcon, PlayIcon, TrimIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useAudioResult, useFileProcessing, useObjectURL, useVideoToAudio } from "@/hooks";
import { formatDuration, formatFileSize, getAudioInfo, getWaveformData, trimAudio } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { getFileBaseName } from "@/lib/utils";

export default function TrimAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | "region" | null>(null);

  // Use custom hooks
  const { url: audioUrl, setSource: setAudioSource, revoke: revokeAudio } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const loadIdRef = useRef(0);

  const handleAudioReady = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        const currentLoadId = ++loadIdRef.current;

        setFile(selectedFile);
        clearResult();

        try {
          const info = await getAudioInfo(selectedFile);
          if (loadIdRef.current !== currentLoadId) return;

          setDuration(info.duration);
          setStartTime(0);
          setEndTime(info.duration);

          const waveformData = await getWaveformData(selectedFile, 200);
          if (loadIdRef.current !== currentLoadId) return;

          setWaveform(waveformData);
          setAudioSource(selectedFile);
        } catch {
          if (loadIdRef.current === currentLoadId) {
            setError("Failed to load audio file. Please try a different format.");
          }
        }
      }
    },
    [clearResult, setAudioSource, setError],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      processFileSelection(files, handleAudioReady);
    },
    [processFileSelection, handleAudioReady],
  );

  const handleClear = useCallback(() => {
    revokeAudio();
    clearResult();
    setFile(null);
    setDuration(0);
    setWaveform([]);
  }, [revokeAudio, clearResult]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, startTime]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);

    if (audioRef.current.currentTime >= endTime) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [endTime]);

  const handleTrim = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const trimmed = await trimAudio(file, startTime, endTime);
      const baseName = getFileBaseName(file.name);
      setResult(trimmed, `${baseName}_trimmed.wav`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to trim audio"));
    } finally {
      stopProcessing();
    }
  }, [file, startTime, endTime, startProcessing, setResult, setError, stopProcessing]);

  const handleStartOver = useCallback(() => {
    revokeAudio();
    clearResult();
    setFile(null);
    setDuration(0);
    setWaveform([]);
  }, [revokeAudio, clearResult]);

  const handleEnded = useCallback(() => setIsPlaying(false), []);

  // Drag handling for waveform selection
  const getTimeFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!waveformRef.current || duration === 0) return null;
      const rect = waveformRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration],
  );

  const handleMouseDown = useCallback(
    (type: "start" | "end" | "region") => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(type);
    },
    [],
  );

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
        const regionDuration = endTime - startTime;
        const newStart = Math.max(0, Math.min(time - regionDuration / 2, duration - regionDuration));
        setStartTime(newStart);
        setEndTime(() => newStart + regionDuration);
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, startTime, endTime, duration, getTimeFromEvent]);

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const selectedDuration = endTime - startTime;

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
          subtitle={`Duration: ${formatDuration(selectedDuration)} • ${formatFileSize(result.blob.size)}`}
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
          {audioUrl && <audio ref={audioRef} src={audioUrl} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} />}

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
              type="button"
              onClick={handleClear}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Change file
            </button>
          </div>

          {/* Waveform with draggable selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="input-label">Drag handles to select region</span>
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
                {waveform.map((val, barIndex) => (
                  <div key={barIndex} className="flex-1 mx-px bg-muted-foreground/30" style={{ height: `${val * 80}%` }} />
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
                role="slider"
                aria-label="Selected audio region"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(startPercent)}
                tabIndex={0}
                className={`absolute top-0 bottom-0 cursor-grab ${dragging === "region" ? "cursor-grabbing" : ""}`}
                style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
                onMouseDown={handleMouseDown("region")}
              />

              {/* Start handle */}
              <div
                role="slider"
                aria-label="Trim start"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(startPercent)}
                tabIndex={0}
                className={`absolute top-0 bottom-0 w-3 bg-primary cursor-ew-resize hover:bg-primary/80 flex items-center justify-center ${dragging === "start" ? "bg-primary/80" : ""}`}
                style={{ left: `calc(${startPercent}% - 6px)` }}
                onMouseDown={handleMouseDown("start")}
              >
                <div className="w-0.5 h-8 bg-primary-foreground/50" />
              </div>

              {/* End handle */}
              <div
                role="slider"
                aria-label="Trim end"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(endPercent)}
                tabIndex={0}
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
                type="button"
                onClick={togglePlay}
                className="w-12 h-12 border-2 border-foreground flex items-center justify-center hover:bg-muted transition-colors"
              >
                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Selected duration</p>
                <p className="text-xl font-bold font-mono">{formatDuration(selectedDuration)}</p>
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

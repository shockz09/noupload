"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { reverseAudio, formatDuration, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { ReverseIcon, LoaderIcon } from "@/components/icons";
import { ErrorBox, SuccessCard, AudioFileInfo, AudioPageHeader, VideoExtractionProgress } from "@/components/audio/shared";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";

export default function ReverseAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();
  const processingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const processFile = useCallback(async (fileToProcess: File) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const info = await getAudioInfo(fileToProcess);
      setDuration(info.duration);
      const processed = await reverseAudio(fileToProcess);
      const baseName = fileToProcess.name.split(".").slice(0, -1).join(".");
      setResult(processed, `${baseName}_reversed.wav`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reverse audio");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [setResult]);

  const handleAudioReady = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      clearResult();

      const url = URL.createObjectURL(selectedFile);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);

      try {
        const info = await getAudioInfo(selectedFile);
        setDuration(info.duration);
      } catch {
        // ignore
      }

      if (isInstant) {
        processFile(selectedFile);
      }
    }
  }, [isInstant, processFile, audioUrl, clearResult]);

  const handleFileSelected = useCallback((files: File[]) => {
    processFileSelection(files, handleAudioReady);
  }, [processFileSelection, handleAudioReady]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("audio/")) {
          const f = item.getAsFile();
          if (f) handleFileSelected([f]);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFileSelected]);

  const handleClear = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    clearResult();
    setFile(null);
    setAudioUrl(null);
    setError(null);
    setDuration(0);
  };

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<ReverseIcon className="w-7 h-7" />}
        iconClass="tool-audio-reverse"
        title="Reverse Audio"
        description="Play audio backwards"
      />

      {result ? (
        <SuccessCard
          stampText="Reversed"
          title="Audio Reversed!"
          subtitle={`${formatDuration(duration)} • ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Reversed Audio"
          onDownload={download}
          onStartOver={handleClear}
          startOverLabel="Reverse Another"
        >
          <AudioPlayer src={result.url} />
        </SuccessCard>
      ) : isProcessing ? (
        <div className="border-2 border-foreground p-12 bg-card overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-4 max-w-full">
            <LoaderIcon className="w-8 h-8 animate-spin" />
            <div className="text-center w-full min-w-0">
              <p className="font-bold">Reversing audio...</p>
              <p className="text-sm text-muted-foreground truncate">{file?.name}</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorBox message={error} />
          <button onClick={handleClear} className="btn-secondary w-full">Try Again</button>
        </div>
      ) : isExtracting ? (
        <VideoExtractionProgress state={extractionState} progress={extractionProgress} filename={videoFilename} />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={AUDIO_VIDEO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your audio or video file here"
            subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
          />
          <div className="info-box">
            <ReverseIcon className="w-5 h-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">{isInstant ? "Instant reverse" : "Manual mode"}</p>
              <p className="text-muted-foreground">
                {isInstant
                  ? "Drop an audio file and it will be reversed automatically."
                  : "Drop an audio file, preview it, then click to reverse."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <AudioFileInfo file={file} duration={duration} onClear={handleClear} />
          {audioUrl && <AudioPlayer src={audioUrl} />}
          <button onClick={() => processFile(file)} disabled={isProcessing} className="btn-primary w-full">
            <ReverseIcon className="w-5 h-5" />Reverse Audio
          </button>
        </div>
      )}
    </div>
  );
}

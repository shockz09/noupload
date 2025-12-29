"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { applyFade, downloadAudio, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { FadeIcon } from "@/components/icons";
import {
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

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
      <AudioPageHeader
        icon={<FadeIcon className="w-7 h-7" />}
        iconClass="tool-audio-fade"
        title="Fade Effect"
        description="Add fade in and fade out effects"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Fade Applied!"
          subtitle={`Fade in: ${fadeIn}s • Fade out: ${fadeOut}s • ${formatFileSize(result.size)}`}
          downloadLabel="Download Audio"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Process Another"
        />
      ) : !file ? (
        <FileDropzone
          accept=".mp3,.wav,.ogg,.m4a,.webm"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio file here"
          subtitle="MP3, WAV, OGG, M4A, WebM"
        />
      ) : (
        <div className="space-y-6">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          {audioUrl && <audio controls src={audioUrl} className="w-full" />}

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="input-label">Fade In Duration</label>
                <span className="text-sm font-bold">{fadeIn}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={maxFade}
                step="0.1"
                value={fadeIn}
                onChange={(e) => setFadeIn(Number(e.target.value))}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="input-label">Fade Out Duration</label>
                <span className="text-sm font-bold">{fadeOut}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={maxFade}
                step="0.1"
                value={fadeOut}
                onChange={(e) => setFadeOut(Number(e.target.value))}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
              />
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleProcess}
            disabled={fadeIn === 0 && fadeOut === 0}
            isProcessing={isProcessing}
            processingLabel="Processing..."
            icon={<FadeIcon className="w-5 h-5" />}
            label="Apply Fade"
          />
        </div>
      )}
    </div>
  );
}

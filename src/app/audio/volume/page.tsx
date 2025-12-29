"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { adjustVolume, downloadAudio, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { VolumeIcon } from "@/components/icons";
import {
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

export default function VolumeAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
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
      const processed = await adjustVolume(file, volume / 100);
      setResult(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust volume");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result && file) {
      const baseName = file.name.split(".").slice(0, -1).join(".");
      downloadAudio(result, `${baseName}_volume.wav`);
    }
  };

  const handleStartOver = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setResult(null);
    setError(null);
    setVolume(100);
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<VolumeIcon className="w-7 h-7" />}
        iconClass="tool-audio-volume"
        title="Adjust Volume"
        description="Increase or decrease audio volume"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Volume Adjusted!"
          subtitle={`${volume}% volume • ${formatFileSize(result.size)}`}
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="input-label">Volume</label>
              <span className="text-sm font-bold">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="300"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mute</span>
              <span>Normal</span>
              <span>3x Louder</span>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleProcess}
            isProcessing={isProcessing}
            processingLabel="Processing..."
            icon={<VolumeIcon className="w-5 h-5" />}
            label="Adjust Volume"
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { changeSpeed, downloadAudio, formatDuration, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { SpeedIcon } from "@/components/icons";
import {
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";
import { AudioPlayer } from "@/components/audio/AudioPlayer";

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
      <AudioPageHeader
        icon={<SpeedIcon className="w-7 h-7" />}
        iconClass="tool-audio-speed"
        title="Change Speed"
        description="Speed up or slow down audio"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Speed Changed!"
          subtitle={`${speed}x speed • ${formatDuration(newDuration)} • ${formatFileSize(result.size)}`}
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

          {audioUrl && <AudioPlayer src={audioUrl} />}

          <div className="space-y-3">
            <label className="input-label">Speed</label>
            <div className="grid grid-cols-6 gap-2">
              {speedPresets.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-3 py-2 text-sm font-bold border-2 border-foreground transition-colors ${
                    speed === s ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
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

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleProcess}
            disabled={speed === 1}
            isProcessing={isProcessing}
            processingLabel="Processing..."
            icon={<SpeedIcon className="w-5 h-5" />}
            label={`Change Speed to ${speed}x`}
          />
        </div>
      )}
    </div>
  );
}

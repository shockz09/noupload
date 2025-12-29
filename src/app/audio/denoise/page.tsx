"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { denoiseAudio, isFFmpegLoaded, DenoiseStrength } from "@/lib/ffmpeg-utils";
import { formatFileSize, getAudioInfo, downloadAudio } from "@/lib/audio-utils";
import { DenoiseIcon } from "@/components/icons";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

const strengthOptions: { value: DenoiseStrength; label: string; desc: string }[] = [
  { value: "light", label: "Light", desc: "Subtle, preserves quality" },
  { value: "medium", label: "Medium", desc: "Balanced reduction" },
  { value: "strong", label: "Strong", desc: "Aggressive, may affect quality" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "denoising";

export default function DenoiseAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [strength, setStrength] = useState<DenoiseStrength>("medium");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      try {
        const info = await getAudioInfo(selectedFile);
        setDuration(info.duration);
      } catch {
        // Duration not critical
      }
    }
  }, []);

  const handleDenoise = async () => {
    if (!file) return;

    setError(null);
    setProgress(0);

    try {
      if (!isFFmpegLoaded()) {
        setProcessingState("loading-ffmpeg");
      }

      setProcessingState("denoising");

      const blob = await denoiseAudio(file, strength, (p) => setProgress(p));

      const baseName = file.name.split(".").slice(0, -1).join(".");
      setResult({ blob, filename: `${baseName}_denoised.wav` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to denoise audio");
    } finally {
      setProcessingState("idle");
    }
  };

  const handleDownload = () => {
    if (result) {
      downloadAudio(result.blob, result.filename);
    }
  };

  const handleStartOver = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setDuration(0);
  };

  const isProcessing = processingState !== "idle";

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<DenoiseIcon className="w-7 h-7" />}
        iconClass="tool-audio-denoise"
        title="Denoise Audio"
        description="Remove background noise from recordings"
      />

      {result ? (
        <SuccessCard
          stampText="Cleaned"
          title="Audio Denoised!"
          subtitle={`Strength: ${strength.charAt(0).toUpperCase() + strength.slice(1)} | ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Cleaned Audio"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Denoise Another"
        />
      ) : !file ? (
        <FileDropzone
          accept=".mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio file here"
          subtitle="MP3, WAV, OGG, M4A, WebM, AAC, FLAC"
        />
      ) : (
        <div className="space-y-4">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          <div className="border-2 border-foreground p-4 bg-card space-y-3">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Noise Reduction Strength</label>
            <div className="grid grid-cols-3 gap-2">
              {strengthOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStrength(opt.value)}
                  className={`p-3 border-2 text-center transition-all ${
                    strength === opt.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/30 hover:border-foreground"
                  }`}
                >
                  <span className="block font-bold">{opt.label}</span>
                  <span className={`block text-xs ${strength === opt.value ? "text-background/70" : "text-muted-foreground"}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!isFFmpegLoaded() && <FFmpegNotice />}

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <ProgressBar
              progress={progress}
              label={processingState === "loading-ffmpeg" ? "Loading audio engine..." : "Removing noise..."}
            />
          )}

          <ProcessButton
            onClick={handleDenoise}
            isProcessing={isProcessing}
            processingLabel={processingState === "loading-ffmpeg" ? "Loading..." : "Denoising..."}
            icon={<DenoiseIcon className="w-5 h-5" />}
            label="Denoise Audio"
          />
        </div>
      )}
    </div>
  );
}

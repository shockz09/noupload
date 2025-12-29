"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { normalizeAudio, isFFmpegLoaded, NormalizePreset } from "@/lib/ffmpeg-utils";
import { formatFileSize, getAudioInfo, downloadAudio } from "@/lib/audio-utils";
import { NormalizeIcon } from "@/components/icons";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

const presets: { value: NormalizePreset; label: string; desc: string; lufs: string }[] = [
  { value: "spotify", label: "Spotify", desc: "Music streaming", lufs: "-14 LUFS" },
  { value: "youtube", label: "YouTube", desc: "Video platform", lufs: "-14 LUFS" },
  { value: "podcast", label: "Podcast", desc: "Voice content", lufs: "-16 LUFS" },
  { value: "broadcast", label: "Broadcast", desc: "TV/Radio standard", lufs: "-23 LUFS" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "normalizing";

export default function NormalizeAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [preset, setPreset] = useState<NormalizePreset>("podcast");
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

  const handleNormalize = async () => {
    if (!file) return;

    setError(null);
    setProgress(0);

    try {
      if (!isFFmpegLoaded()) {
        setProcessingState("loading-ffmpeg");
      }

      setProcessingState("normalizing");

      const blob = await normalizeAudio(file, preset, (p) => setProgress(p));

      const baseName = file.name.split(".").slice(0, -1).join(".");
      setResult({ blob, filename: `${baseName}_normalized.wav` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to normalize audio");
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
  const selectedPreset = presets.find(p => p.value === preset);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<NormalizeIcon className="w-7 h-7" />}
        iconClass="tool-audio-normalize"
        title="Normalize Audio"
        description="Make audio volume consistent for any platform"
      />

      {result ? (
        <SuccessCard
          stampText="Normalized"
          title="Audio Normalized!"
          subtitle={`Target: ${selectedPreset?.label} (${selectedPreset?.lufs}) | ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Normalized Audio"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Normalize Another"
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

          {/* Preset Selection */}
          <div className="border-2 border-foreground p-4 bg-card space-y-3">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Target Platform</label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`p-3 border-2 text-left transition-all ${
                    preset === p.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/30 hover:border-foreground"
                  }`}
                >
                  <span className="block font-bold">{p.label}</span>
                  <span className={`block text-xs ${preset === p.value ? "text-background/70" : "text-muted-foreground"}`}>
                    {p.desc} • {p.lufs}
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
              label={processingState === "loading-ffmpeg" ? "Loading audio engine..." : "Normalizing..."}
            />
          )}

          <ProcessButton
            onClick={handleNormalize}
            isProcessing={isProcessing}
            processingLabel={processingState === "loading-ffmpeg" ? "Loading..." : "Normalizing..."}
            icon={<NormalizeIcon className="w-5 h-5" />}
            label="Normalize Audio"
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { removeSilence, isFFmpegLoaded, SilenceMode } from "@/lib/ffmpeg-utils";
import { formatFileSize, getAudioInfo, downloadAudio } from "@/lib/audio-utils";
import { SilenceIcon } from "@/components/icons";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

const modes: { value: SilenceMode; label: string; desc: string }[] = [
  { value: "trim-ends", label: "Trim Ends", desc: "Remove silence at start and end only" },
  { value: "remove-all", label: "Remove All", desc: "Remove all silence throughout" },
];

const thresholds = [
  { value: -40, label: "-40 dB", desc: "Aggressive" },
  { value: -50, label: "-50 dB", desc: "Normal" },
  { value: -60, label: "-60 dB", desc: "Sensitive" },
];

const durations = [
  { value: 0.3, label: "0.3s", desc: "Quick" },
  { value: 0.5, label: "0.5s", desc: "Normal" },
  { value: 1.0, label: "1.0s", desc: "Long" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "processing";

export default function RemoveSilencePage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<SilenceMode>("trim-ends");
  const [threshold, setThreshold] = useState(-50);
  const [minDuration, setMinDuration] = useState(0.5);
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

  const handleProcess = async () => {
    if (!file) return;

    setError(null);
    setProgress(0);

    try {
      if (!isFFmpegLoaded()) {
        setProcessingState("loading-ffmpeg");
      }

      setProcessingState("processing");

      const blob = await removeSilence(file, mode, threshold, minDuration, (p) => setProgress(p));

      const baseName = file.name.split(".").slice(0, -1).join(".");
      setResult({ blob, filename: `${baseName}_trimmed.wav` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove silence");
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
        icon={<SilenceIcon className="w-7 h-7" />}
        iconClass="tool-audio-silence"
        title="Remove Silence"
        description="Trim silent parts from audio recordings"
      />

      {result ? (
        <SuccessCard
          stampText="Trimmed"
          title="Silence Removed!"
          subtitle={`${mode === "trim-ends" ? "Ends trimmed" : "All silence removed"} | ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Trimmed Audio"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Process Another"
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

          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {modes.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`p-3 border-2 text-left transition-all ${
                      mode === m.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block font-bold">{m.label}</span>
                    <span className={`block text-xs ${mode === m.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {m.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-foreground/10">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Silence Threshold</label>
              <div className="flex gap-1">
                {thresholds.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setThreshold(t.value)}
                    className={`flex-1 px-2 py-2 text-center border-2 transition-all ${
                      threshold === t.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block text-sm font-bold">{t.label}</span>
                    <span className={`block text-xs ${threshold === t.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-foreground/10">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Min Silence Duration</label>
              <div className="flex gap-1">
                {durations.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setMinDuration(d.value)}
                    className={`flex-1 px-2 py-2 text-center border-2 transition-all ${
                      minDuration === d.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block text-sm font-bold">{d.label}</span>
                    <span className={`block text-xs ${minDuration === d.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {d.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!isFFmpegLoaded() && <FFmpegNotice />}

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <ProgressBar
              progress={progress}
              label={processingState === "loading-ffmpeg" ? "Loading audio engine..." : "Removing silence..."}
            />
          )}

          <ProcessButton
            onClick={handleProcess}
            isProcessing={isProcessing}
            processingLabel={processingState === "loading-ffmpeg" ? "Loading..." : "Processing..."}
            icon={<SilenceIcon className="w-5 h-5" />}
            label="Remove Silence"
          />
        </div>
      )}
    </div>
  );
}

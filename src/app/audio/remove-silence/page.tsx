"use client";

import { useCallback, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
  AudioFileInfo,
  AudioPageHeader,
  ErrorBox,
  FFmpegNotice,
  ProcessButton,
  ProgressBar,
  SuccessCard,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { SilenceIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { isFFmpegLoaded, removeSilence, type SilenceMode } from "@/lib/ffmpeg-utils";
import { getFileBaseName } from "@/lib/utils";

const modes: { value: SilenceMode; label: string; desc: string }[] = [
  {
    value: "trim-ends",
    label: "Trim Ends",
    desc: "Remove silence at start and end only",
  },
  {
    value: "remove-all",
    label: "Remove All",
    desc: "Remove all silence throughout",
  },
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
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<SilenceMode>("trim-ends");
  const [usedMode, setUsedMode] = useState<SilenceMode>("trim-ends");
  const [threshold, setThreshold] = useState(-50);
  const [minDuration, setMinDuration] = useState(0.5);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();
  const processingRef = useRef(false);

  const processFile = useCallback(
    async (fileToProcess: File, silenceMode: SilenceMode, thresh: number, minDur: number) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setError(null);
      setProgress(0);

      try {
        if (!isFFmpegLoaded()) {
          setProcessingState("loading-ffmpeg");
        }

        setProcessingState("processing");

        const blob = await removeSilence(fileToProcess, silenceMode, thresh, minDur, (p) => setProgress(p));

        const baseName = getFileBaseName(fileToProcess.name);
        setResult(blob, `${baseName}_trimmed.wav`);
        setUsedMode(silenceMode);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to remove silence"));
      } finally {
        setProcessingState("idle");
        processingRef.current = false;
      }
    },
    [setResult],
  );

  const handleAudioReady = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        setError(null);
        clearResult();

        try {
          const info = await getAudioInfo(selectedFile);
          setDuration(info.duration);
        } catch {
          // Duration not critical
        }

        if (isInstant) {
          // Instant mode: remove-all with normal settings
          processFile(selectedFile, "remove-all", -50, 0.5);
        }
      }
    },
    [isInstant, processFile, clearResult],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      processFileSelection(files, handleAudioReady);
    },
    [processFileSelection, handleAudioReady],
  );

  const handleProcess = async () => {
    if (!file) return;
    processFile(file, mode, threshold, minDuration);
  };

  const handleStartOver = () => {
    clearResult();
    setFile(null);
    setError(null);
    setProgress(0);
    setDuration(0);
  };

  const isProcessing = processingState !== "idle";

  if (!isLoaded) return null;

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
          subtitle={`${usedMode === "trim-ends" ? "Ends trimmed" : "All silence removed"} | ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Trimmed Audio"
          onDownload={download}
          onStartOver={handleStartOver}
          startOverLabel="Process Another"
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
        <div className="space-y-4">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mode</span>
              <div className="grid grid-cols-2 gap-2">
                {modes.map((m) => (
                  <button
                    type="button"
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`p-3 border-2 text-left transition-all ${
                      mode === m.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block font-bold">{m.label}</span>
                    <span
                      className={`block text-xs ${mode === m.value ? "text-background/70" : "text-muted-foreground"}`}
                    >
                      {m.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-foreground/10">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Silence Threshold</span>
              <div className="flex gap-1">
                {thresholds.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setThreshold(t.value)}
                    className={`flex-1 px-2 py-2 text-center border-2 transition-all ${
                      threshold === t.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block text-sm font-bold">{t.label}</span>
                    <span
                      className={`block text-xs ${threshold === t.value ? "text-background/70" : "text-muted-foreground"}`}
                    >
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-foreground/10">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Min Silence Duration
              </span>
              <div className="flex gap-1">
                {durations.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => setMinDuration(d.value)}
                    className={`flex-1 px-2 py-2 text-center border-2 transition-all ${
                      minDuration === d.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block text-sm font-bold">{d.label}</span>
                    <span
                      className={`block text-xs ${minDuration === d.value ? "text-background/70" : "text-muted-foreground"}`}
                    >
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

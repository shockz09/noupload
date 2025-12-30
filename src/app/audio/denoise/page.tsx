"use client";

import { useState, useCallback, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { denoiseAudio, isFFmpegLoaded, DenoiseStrength } from "@/lib/ffmpeg-utils";
import { formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { DenoiseIcon } from "@/components/icons";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioFileInfo,
  AudioPageHeader,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";

const strengthOptions: { value: DenoiseStrength; label: string; desc: string }[] = [
  { value: "light", label: "Light", desc: "Subtle, preserves quality" },
  { value: "medium", label: "Medium", desc: "Balanced reduction" },
  { value: "strong", label: "Strong", desc: "Aggressive, may affect quality" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "denoising";

export default function DenoiseAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [strength, setStrength] = useState<DenoiseStrength>("medium");
  const [usedStrength, setUsedStrength] = useState<DenoiseStrength>("medium");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();
  const processingRef = useRef(false);

  const processFile = useCallback(async (fileToProcess: File, denoiseStrength: DenoiseStrength) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setError(null);
    setProgress(0);

    try {
      if (!isFFmpegLoaded()) {
        setProcessingState("loading-ffmpeg");
      }

      setProcessingState("denoising");

      const blob = await denoiseAudio(fileToProcess, denoiseStrength, (p) => setProgress(p));

      const baseName = fileToProcess.name.split(".").slice(0, -1).join(".");
      setResult(blob, `${baseName}_denoised.wav`);
      setUsedStrength(denoiseStrength);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to denoise audio");
    } finally {
      setProcessingState("idle");
      processingRef.current = false;
    }
  }, [setResult]);

  const handleAudioReady = useCallback(async (files: File[]) => {
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
        processFile(selectedFile, "medium");
      }
    }
  }, [isInstant, processFile, clearResult]);

  const handleFileSelected = useCallback((files: File[]) => {
    processFileSelection(files, handleAudioReady);
  }, [processFileSelection, handleAudioReady]);

  const handleDenoise = async () => {
    if (!file) return;
    processFile(file, strength);
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
        icon={<DenoiseIcon className="w-7 h-7" />}
        iconClass="tool-audio-denoise"
        title="Denoise Audio"
        description="Remove background noise from recordings"
      />

      {result ? (
        <SuccessCard
          stampText="Cleaned"
          title="Audio Denoised!"
          subtitle={`Strength: ${usedStrength.charAt(0).toUpperCase() + usedStrength.slice(1)} | ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Cleaned Audio"
          onDownload={download}
          onStartOver={handleStartOver}
          startOverLabel="Denoise Another"
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

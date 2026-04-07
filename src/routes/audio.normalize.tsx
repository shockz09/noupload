import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/audio/normalize")({
	head: () => ({
		meta: [
			{ title: "Normalize Audio Free - Adjust Audio Levels | noupload" },
			{ name: "description", content: "Normalize audio volume for free. Balance audio levels across files. Consistent loudness. Works offline, your files stay private." },
			{ name: "keywords", content: "normalize audio, audio normalization, balance audio, audio levels, loudness normalization, free audio normalizer" },
			{ property: "og:title", content: "Normalize Audio Free - Adjust Audio Levels" },
			{ property: "og:description", content: "Normalize audio volume for free. Works 100% offline." },
		],
	}),
	component: NormalizeAudioPage,
});

import { useCallback, useRef, useState } from "react";
import {
  AudioFileInfo,
  AudioPageHeader,
  AudioResultView,
  ErrorBox,
  FFmpegNotice,
  ProcessButton,
  ProgressBar,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { NormalizeIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult, useFileBuffer, useVideoToAudio } from "@/hooks";
import { getAudioInfo } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { isFFmpegLoaded, type NormalizePreset, normalizeAudio } from "@/lib/ffmpeg-utils";
import { getFileBaseName } from "@/lib/utils";

const presets: {
  value: NormalizePreset;
  label: string;
  desc: string;
  lufs: string;
}[] = [
  {
    value: "spotify",
    label: "Spotify",
    desc: "Music streaming",
    lufs: "-14 LUFS",
  },
  {
    value: "youtube",
    label: "YouTube",
    desc: "Video platform",
    lufs: "-14 LUFS",
  },
  {
    value: "podcast",
    label: "Podcast",
    desc: "Voice content",
    lufs: "-16 LUFS",
  },
  {
    value: "broadcast",
    label: "Broadcast",
    desc: "TV/Radio standard",
    lufs: "-23 LUFS",
  },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "normalizing";

function NormalizeAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [preset, setPreset] = useState<NormalizePreset>("podcast");
  const [usedPreset, setUsedPreset] = useState<NormalizePreset>("podcast");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();
  const processingRef = useRef(false);

  const processFile = useCallback(
    async (fileToProcess: File, targetPreset: NormalizePreset) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setError(null);
      setProgress(0);

      try {
        if (!isFFmpegLoaded()) {
          setProcessingState("loading-ffmpeg");
        }

        setProcessingState("normalizing");

        const blob = await normalizeAudio(fileToProcess, targetPreset, (p) => setProgress(p));

        const baseName = getFileBaseName(fileToProcess.name);
        setResult(blob, `${baseName}_normalized.wav`);
        setUsedPreset(targetPreset);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to normalize audio"));
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
          processFile(selectedFile, "podcast"); // -16 LUFS default
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

  const handleNormalize = async () => {
    if (!file) return;
    processFile(file, preset);
  };

  const handleStartOver = () => {
    clearResult();
    setFile(null);
    setError(null);
    setProgress(0);
    setDuration(0);
  };

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: result.blob.type,
      size: result.blob.size,
      fileType: "audio",
      sourceToolLabel: "Normalize Audio",
    });
  }, [result, addToBuffer]);

  const isProcessing = processingState !== "idle";
  const _selectedPreset = presets.find((p) => p.value === preset);
  const usedPresetInfo = presets.find((p) => p.value === usedPreset);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<NormalizeIcon className="w-7 h-7" />}
        iconClass="tool-audio-normalize"
        title="Normalize Audio"
        description="Make audio volume consistent for any platform"
      />

      {result ? (
        <AudioResultView
          url={result.url}
          blobSize={result.blob.size}
          title="Audio Normalized!"
          subtitle={`Target: ${usedPresetInfo?.label} (${usedPresetInfo?.lufs})`}
          downloadLabel="Download Normalized Audio"
          onDownload={download}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Normalize Another"
        />
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

          {/* Preset Selection */}
          <div className="border-2 border-foreground p-4 bg-card space-y-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Target Platform</span>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`p-3 border-2 text-left transition-all ${
                    preset === p.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/30 hover:border-foreground"
                  }`}
                >
                  <span className="block font-bold">{p.label}</span>
                  <span
                    className={`block text-xs ${preset === p.value ? "text-background/70" : "text-muted-foreground"}`}
                  >
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

"use client";

import { useCallback, useState } from "react";
import { VideoCompressIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ComparisonDisplay,
  ErrorBox,
  InfoBox,
  SavingsBadge,
  SuccessCard,
  VideoFileInfo,
  VideoPageHeader,
} from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import {
  analyzeVideo,
  compressVideo,
  type CompressOptions,
  type CompressResult,
  type VideoInfo,
} from "@/lib/video/compress";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";

// ── Presets ─────────────────────────────────────────────────
type PresetKey = "light" | "balanced" | "maximum";

interface Preset {
  label: string;
  description: string;
  bitrateMultiplier: number; // % of source bitrate
  resolution: CompressOptions["resolution"];
  codec: CompressOptions["codec"];
  audioBitrate: number;
}

const PRESETS: Record<PresetKey, Preset> = {
  light: {
    label: "Light",
    description: "Best quality, moderate reduction",
    bitrateMultiplier: 0.7,
    resolution: "original",
    codec: "avc",
    audioBitrate: 128_000,
  },
  balanced: {
    label: "Balanced",
    description: "Good quality, significant reduction",
    bitrateMultiplier: 0.4,
    resolution: "original",
    codec: "avc",
    audioBitrate: 128_000,
  },
  maximum: {
    label: "Maximum",
    description: "Smallest size, some quality loss",
    bitrateMultiplier: 0.2,
    resolution: "720p",
    codec: "hevc",
    audioBitrate: 96_000,
  },
};

function getPresetOptions(preset: PresetKey, info: VideoInfo): CompressOptions {
  const p = PRESETS[preset];
  // Don't downscale if source is already smaller
  const resolution =
    p.resolution !== "original" && info.height <= 720 ? "original" : p.resolution;
  return {
    videoBitrate: Math.max(100_000, Math.round(info.videoBitrate * p.bitrateMultiplier)),
    audioBitrate: p.audioBitrate,
    codec: p.codec,
    resolution,
    frameRate: null,
  };
}

function estimateReduction(preset: PresetKey, info: VideoInfo): number {
  const opts = getPresetOptions(preset, info);
  let estimate = 1 - opts.videoBitrate / info.videoBitrate;
  // Rough bonus for downscale
  if (opts.resolution === "720p" && info.height > 720) estimate += 0.15;
  if (opts.resolution === "480p" && info.height > 480) estimate += 0.25;
  // Bonus for HEVC
  if (opts.codec === "hevc") estimate += 0.1;
  return Math.min(Math.round(estimate * 100), 95);
}

// ── Component ───────────────────────────────────────────────

export default function VideoCompressPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [result, setResult] = useState<CompressResult | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, opts: CompressOptions) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        const compressed = await compressVideo(f, opts, (p) => setProgress(p * 100));
        setResult(compressed);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to compress video"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const selectedFile = files[0];
      setFile(selectedFile);
      setResult(null);
      clearError();

      setAnalyzing(true);
      try {
        const info = await analyzeVideo(selectedFile);
        setVideoInfo(info);

        if (isInstant) {
          processFile(selectedFile, getPresetOptions("balanced", info));
        }
      } catch {
        setError("Could not analyze video. The format may not be supported.");
      }
      setAnalyzing(false);
    },
    [isInstant, processFile, clearError, setError],
  );

  const handleCompress = useCallback(() => {
    if (!file || !videoInfo) return;
    processFile(file, getPresetOptions(preset, videoInfo));
  }, [file, videoInfo, preset, processFile]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename, "video/mp4");
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setVideoInfo(null);
    setResult(null);
    clearError();
  }, [clearError]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "video/mp4",
      size: result.blob.size,
      fileType: "other",
      sourceToolLabel: "Compress Video",
    });
  }, [result, addToBuffer]);

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoCompressIcon className="w-7 h-7" />}
        iconClass="tool-video-compress"
        title="Compress Video"
        description="Reduce file size while preserving quality"
      />

      {result ? (
        <SuccessCard
          stampText="Compressed"
          title="Video Compressed!"
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        >
          <ComparisonDisplay
            originalLabel="Original"
            originalValue={formatFileSize(result.originalSize)}
            newLabel="Compressed"
            newValue={formatFileSize(result.compressedSize)}
          />
          <SavingsBadge savings={savings} />
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox title={isInstant ? "Instant compression" : "About video compression"}>
            {isInstant
              ? "Drop a video and it will be compressed automatically."
              : "Hardware-accelerated compression runs entirely in your browser. No uploads, complete privacy."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Analyzing state */}
          {analyzing && (
            <div className="flex items-center gap-3 p-4 border-2 border-foreground/30 bg-muted/30">
              <span className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              <span className="text-sm font-medium text-muted-foreground">Analyzing video...</span>
            </div>
          )}

          {/* File info */}
          {videoInfo && (
            <VideoFileInfo
              file={file}
              duration={videoInfo.duration}
              resolution={`${videoInfo.width}×${videoInfo.height}`}
              onClear={handleStartOver}
              icon={<VideoToolIcon className="w-5 h-5" />}
            />
          )}

          {/* Preset selector (after file) */}
          {videoInfo && !isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Compression Level</legend>
              <div className="grid grid-cols-3 gap-3" role="group">
                {(["light", "balanced", "maximum"] as PresetKey[]).map((key) => {
                  const p = PRESETS[key];
                  const est = estimateReduction(key, videoInfo);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreset(key)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        preset === key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="font-medium capitalize text-sm">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">~{est}% smaller</div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {error && <ErrorBox message={error} />}

          {/* Compress button */}
          <button type="button" onClick={handleCompress} disabled={isProcessing || analyzing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Compressing... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoCompressIcon className="w-5 h-5" />
                Compress Video
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

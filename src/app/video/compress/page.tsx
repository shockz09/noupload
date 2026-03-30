"use client";

import { useCallback, useMemo, useState } from "react";
import { DownloadIcon } from "@/components/icons/ui";
import { VideoCompressIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ComparisonDisplay,
  ErrorBox,
  InfoBox,
  ProgressBar,
  SavingsBadge,
  SuccessCard,
  VideoFileInfo,
  VideoPageHeader,
} from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob, downloadMultiple } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import {
  analyzeVideo,
  compressVideo,
  type CompressOptions,
  type CompressResult,
  type VideoInfo,
} from "@/lib/video/compress";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

// ── Presets ─────────────────────────────────────────────────
type PresetKey = "light" | "balanced" | "maximum";

interface Preset {
  label: string;
  description: string;
  bitrateMultiplier: number;
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

// ── Bulk types ──────────────────────────────────────────────
interface BulkFileItem {
  id: string;
  file: File;
}

interface BulkCompressItem {
  filename: string;
  originalSize: number;
  compressedSize: number;
  blob: Blob;
  error?: string;
}

// ── Preset Selector ─────────────────────────────────────────
function PresetSelector({
  preset,
  onSelect,
}: {
  preset: PresetKey;
  onSelect: (key: PresetKey) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Compression Level</legend>
      <div className="grid grid-cols-3 gap-3" role="group">
        {(["light", "balanced", "maximum"] as PresetKey[]).map((key) => {
          const p = PRESETS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                preset === key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="font-medium capitalize text-sm">{p.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── Component ───────────────────────────────────────────────

export default function VideoCompressPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [preset, setPreset] = useState<PresetKey>("balanced");

  // ── Single mode state ──
  const [file, setFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CompressResult | null>(null);
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  // ── Bulk mode state ──
  const [bulkFiles, setBulkFiles] = useState<BulkFileItem[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkCompressItem[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const isBulk = bulkFiles.length > 0 || bulkResults.length > 0;

  // ── Single mode handlers ──
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
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) return;

      if (selectedFiles.length === 1 && bulkFiles.length === 0) {
        // Single mode
        const selectedFile = selectedFiles[0];
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
      } else {
        // Bulk mode
        const newItems = selectedFiles.map((f) => ({ id: crypto.randomUUID(), file: f }));
        setBulkFiles((prev) => [...prev, ...newItems]);
        setBulkResults([]);
      }
    },
    [isInstant, processFile, clearError, setError, bulkFiles.length],
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

  // ── Bulk mode handlers ──
  const handleRemoveBulkFile = useCallback((id: string) => {
    setBulkFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleBulkCompress = useCallback(async () => {
    if (bulkFiles.length === 0 || isBulkProcessing) return;

    setIsBulkProcessing(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: bulkFiles.length });

    const results: BulkCompressItem[] = [];

    for (let i = 0; i < bulkFiles.length; i++) {
      const { file: f } = bulkFiles[i];
      try {
        const info = await analyzeVideo(f);
        const opts = getPresetOptions(preset, info);
        const compressed = await compressVideo(f, opts);
        results.push({
          filename: compressed.filename,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          blob: compressed.blob,
        });
      } catch (err) {
        results.push({
          filename: f.name,
          originalSize: f.size,
          compressedSize: 0,
          blob: new Blob(),
          error: getErrorMessage(err, "Failed"),
        });
      }
      setBulkProgress({ current: i + 1, total: bulkFiles.length });
      setBulkResults([...results]);
    }

    setIsBulkProcessing(false);
  }, [bulkFiles, preset, isBulkProcessing]);

  const successfulResults = useMemo(
    () => bulkResults.filter((r) => !r.error && r.compressedSize < r.originalSize),
    [bulkResults],
  );

  const handleBulkDownloadAll = useCallback(() => {
    downloadMultiple(successfulResults.map((r) => ({ data: r.blob, filename: r.filename })));
  }, [successfulResults]);

  const handleBulkDownloadOne = useCallback((item: BulkCompressItem) => {
    downloadBlob(item.blob, item.filename, "video/mp4");
  }, []);

  // ── Shared handlers ──
  const handleStartOver = useCallback(() => {
    setFile(null);
    setVideoInfo(null);
    setResult(null);
    clearError();
    setBulkFiles([]);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: 0 });
  }, [clearError]);

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  const totalBulkSavings = useMemo(() => {
    if (successfulResults.length === 0) return 0;
    const totalOriginal = successfulResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = successfulResults.reduce((sum, r) => sum + r.compressedSize, 0);
    return Math.round((1 - totalCompressed / totalOriginal) * 100);
  }, [successfulResults]);

  const totalBulkOriginalSize = useMemo(
    () => bulkFiles.reduce((sum, f) => sum + f.file.size, 0),
    [bulkFiles],
  );

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoCompressIcon className="w-7 h-7" />}
        iconClass="tool-video-compress"
        title="Compress Video"
        description="Reduce file size while preserving quality"
      />

      {/* ── Single mode result ── */}
      {!isBulk && result ? (
        result.compressedSize >= result.originalSize ? (
          <div className="animate-fade-up space-y-6">
            <div className="p-6 border-2 border-foreground bg-card text-center space-y-4">
              <h2 className="text-2xl font-display">Already Optimized</h2>
              <p className="text-muted-foreground">
                This video is already well-compressed. Re-encoding produced a larger file ({formatFileSize(result.compressedSize)} vs {formatFileSize(result.originalSize)}).
              </p>
              <button type="button" onClick={handleStartOver} className="btn-secondary">
                Try Another Video
              </button>
            </div>
          </div>
        ) : (
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
        )

      /* ── Bulk mode results ── */
      ) : isBulk && bulkResults.length > 0 && !isBulkProcessing ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Done</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">
                {successfulResults.length} Video{successfulResults.length !== 1 ? "s" : ""} Compressed!
              </h2>
              {totalBulkSavings > 0 && <SavingsBadge savings={totalBulkSavings} />}
            </div>
            {successfulResults.length > 0 && (
              <button type="button" onClick={handleBulkDownloadAll} className="btn-success w-full mb-4">
                <DownloadIcon className="w-5 h-5" />
                Download All ({successfulResults.length} files)
              </button>
            )}
          </div>

          <div className="space-y-2">
            {bulkResults.map((item, i) => {
              if (item.error) {
                return (
                  <div key={i} className="flex items-center justify-between p-3 border-2 border-destructive/50 bg-destructive/5">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.filename}</p>
                      <p className="text-xs text-destructive">{item.error}</p>
                    </div>
                  </div>
                );
              }
              const itemSavings = Math.round((1 - item.compressedSize / item.originalSize) * 100);
              const alreadyOptimized = item.compressedSize >= item.originalSize;
              return (
                <div key={i} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {alreadyOptimized
                        ? "Already optimized"
                        : `${formatFileSize(item.originalSize)} → ${formatFileSize(item.compressedSize)} (${itemSavings}% saved)`}
                    </p>
                  </div>
                  {!alreadyOptimized && (
                    <button
                      type="button"
                      onClick={() => handleBulkDownloadOne(item)}
                      className="text-sm font-bold text-primary hover:underline ml-4"
                    >
                      Download
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Compress More Videos
          </button>
        </div>

      /* ── No files: dropzone ── */
      ) : !file && !isBulk ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={true}
            maxFiles={20}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Drop your video files here"
            subtitle="MP4, MOV, WebM, MKV · Single or multiple files"
          />
          <InfoBox title={isInstant ? "Instant compression" : "About video compression"}>
            {isInstant
              ? "Drop a video and it will be compressed automatically."
              : "Hardware-accelerated compression runs entirely in your browser. No uploads, complete privacy."}
          </InfoBox>
        </div>

      /* ── Single mode: file selected ── */
      ) : !isBulk && file ? (
        <div className="space-y-6">
          {analyzing && (
            <div className="flex items-center gap-3 p-4 border-2 border-foreground/30 bg-muted/30">
              <span className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              <span className="text-sm font-medium text-muted-foreground">Analyzing video...</span>
            </div>
          )}

          {videoInfo && (
            <VideoFileInfo
              file={file}
              duration={videoInfo.duration}
              resolution={`${videoInfo.width}×${videoInfo.height}`}
              onClear={handleStartOver}
              icon={<VideoToolIcon className="w-5 h-5" />}
            />
          )}

          {videoInfo && videoInfo.videoBitrate < 500_000 && !isProcessing && (
            <div className="flex items-start gap-3 p-3 border-2 border-foreground/30 bg-muted/30 text-sm">
              <svg aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <p className="text-muted-foreground">
                This video has a very low bitrate ({(videoInfo.videoBitrate / 1000).toFixed(0)} kbps). It&apos;s already well-compressed — further compression may not reduce file size.
              </p>
            </div>
          )}

          {videoInfo && !isProcessing && (
            <PresetSelector preset={preset} onSelect={setPreset} />
          )}

          {error && <ErrorBox message={error} />}

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

      /* ── Bulk mode: files selected ── */
      ) : (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={true}
            maxFiles={20}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Add more videos"
            subtitle="MP4, MOV, WebM, MKV"
            compact
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="input-label">{bulkFiles.length} videos selected</span>
              <button
                type="button"
                onClick={handleStartOver}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                disabled={isBulkProcessing}
              >
                Clear all
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-foreground p-2">
              {bulkFiles.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <VideoToolIcon className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(item.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveBulkFile(item.id)}
                    className="text-xs text-muted-foreground hover:text-foreground ml-2"
                    disabled={isBulkProcessing}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Total: {formatFileSize(totalBulkOriginalSize)}</p>
          </div>

          {!isBulkProcessing && <PresetSelector preset={preset} onSelect={setPreset} />}

          {/* Live results during processing */}
          {isBulkProcessing && bulkResults.length > 0 && (
            <div className="space-y-2">
              {bulkResults.map((item, i) => {
                const itemSavings = item.error ? 0 : Math.round((1 - item.compressedSize / item.originalSize) * 100);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 border-2 ${
                      item.error ? "border-destructive/50 bg-destructive/5" : "border-foreground bg-background"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.filename}</p>
                      <p className={`text-xs ${item.error ? "text-destructive" : "text-muted-foreground"}`}>
                        {item.error
                          ? item.error
                          : item.compressedSize >= item.originalSize
                            ? "Already optimized"
                            : `${formatFileSize(item.originalSize)} → ${formatFileSize(item.compressedSize)} (${itemSavings}% saved)`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isBulkProcessing && (
            <ProgressBar
              progress={(bulkProgress.current / bulkProgress.total) * 100}
              label={`Compressing ${bulkProgress.current} of ${bulkProgress.total}...`}
            />
          )}

          <button
            type="button"
            onClick={handleBulkCompress}
            disabled={isBulkProcessing || bulkFiles.length === 0}
            className="btn-primary w-full"
          >
            {isBulkProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Compressing...
              </>
            ) : (
              <>
                <VideoCompressIcon className="w-5 h-5" />
                Compress {bulkFiles.length} Video{bulkFiles.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

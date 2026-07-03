import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/compress-gif")({
  head: () => ({
    meta: [
      { title: "Compress GIF Free - Reduce Animated GIF File Size | noupload" },
      {
        name: "description",
        content:
          "Compress animated GIF files for free. Shrink GIF file size by reducing colors, resolution, or frame rate. Works offline, completely private.",
      },
      {
        name: "keywords",
        content: "compress gif, reduce gif size, gif compressor, shrink gif, optimize gif, free gif compression",
      },
      { property: "og:title", content: "Compress GIF Free - Reduce Animated GIF File Size" },
      { property: "og:description", content: "Compress animated GIF files for free. Works 100% offline." },
    ],
  }),
  component: VideoCompressGifPage,
});

import { useCallback, useState } from "react";
import { VideoCompressIcon, VideoToolIcon } from "@/components/icons/video";
import { ImageResultView } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader } from "@/components/video/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { VIDEO_MAX_FILE_SIZE } from "@/lib/constants";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { compressGif, type GifCompressOptions, type GifCompressResult } from "@/lib/video/compress-gif";

const GIF_EXTENSIONS = ".gif";

// ── Presets ─────────────────────────────────────────────────
type PresetKey = "light" | "balanced" | "maximum";

const PRESETS: Record<PresetKey, { label: string; description: string } & GifCompressOptions> = {
  light: { label: "Light", description: "Best quality, moderate reduction", colors: 128, scale: 1, frameSkip: 1 },
  balanced: {
    label: "Balanced",
    description: "Good quality, significant reduction",
    colors: 64,
    scale: 0.75,
    frameSkip: 2,
  },
  maximum: { label: "Maximum", description: "Smallest size, some quality loss", colors: 32, scale: 0.5, frameSkip: 3 },
};

function PresetSelector({ preset, onSelect }: { preset: PresetKey; onSelect: (key: PresetKey) => void }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Compression Level</legend>
      <div className="grid grid-cols-3 gap-3" role="group">
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
          const p = PRESETS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                preset === key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="font-medium text-sm">{p.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function VideoCompressGifPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<GifCompressResult | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, options: GifCompressOptions) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await compressGif(f, options, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to compress GIF"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setFile(files[0]);
      setResult(null);
      clearError();
      if (isInstant) processFile(files[0], PRESETS.balanced);
    },
    [isInstant, processFile, clearError],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename, "image/gif");
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    clearError();
  }, [clearError]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "image/gif",
      size: result.blob.size,
      fileType: "other",
      sourceToolLabel: "Compress GIF",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoCompressIcon className="w-7 h-7" />}
        iconClass="tool-video-compress"
        title="Compress GIF"
        description="Reduce animated GIF file size"
      />

      {result ? (
        <ImageResultView
          blob={result.blob}
          title="GIF Compressed!"
          subtitle={`${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} · ${savings}% smaller`}
          downloadLabel="Download GIF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Compress Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={GIF_EXTENSIONS}
            multiple={false}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Drop your GIF file here"
            subtitle="Animated GIF"
          />
          <InfoBox title={isInstant ? "Instant compression" : "About this tool"}>
            {isInstant
              ? "Drop a GIF and it will be compressed automatically."
              : "Shrinks GIF file size by reducing the color palette, resolution, and frame rate."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />

          {!isProcessing && <PresetSelector preset={preset} onSelect={setPreset} />}

          {error && <ErrorBox message={error} />}

          <button
            type="button"
            onClick={() => processFile(file, PRESETS[preset])}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Compressing GIF... {progress > 0 ? `${Math.round(progress)}%` : ""}
              </>
            ) : (
              <>
                <VideoCompressIcon className="w-5 h-5" />
                Compress GIF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

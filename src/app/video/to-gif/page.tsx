"use client";

import { useCallback, useState } from "react";
import { VideoToGifIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader } from "@/components/video/shared";
import { ImageResultView, ProgressBar } from "@/components/image/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { videoToGif, type GifOptions } from "@/lib/video/to-gif";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

const FPS_OPTIONS = [
  { value: 10, label: "10 fps", desc: "Smaller file" },
  { value: 15, label: "15 fps", desc: "Balanced" },
  { value: 20, label: "20 fps", desc: "Smoother" },
  { value: 25, label: "25 fps", desc: "Near video" },
] as const;

const WIDTH_OPTIONS: { value: number | "original"; label: string; desc: string }[] = [
  { value: 320, label: "320px", desc: "Tiny" },
  { value: 480, label: "480px", desc: "Small" },
  { value: 640, label: "640px", desc: "Medium" },
  { value: "original", label: "Original", desc: "Full size" },
];

export default function VideoToGifPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const [fps, setFps] = useState<number>(15);
  const [width, setWidth] = useState<number | "original">(480);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, options: GifOptions) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await videoToGif(f, options, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to convert to GIF"));
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
      if (isInstant) processFile(files[0], { fps, width });
    },
    [isInstant, processFile, clearError, fps, width],
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
      sourceToolLabel: "Video to GIF",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoToGifIcon className="w-7 h-7" />}
        iconClass="tool-video-to-gif"
        title="Video to GIF"
        description="Convert video clips to animated GIFs"
      />

      {result ? (
        <ImageResultView
          blob={result.blob}
          title="GIF Ready!"
          downloadLabel="Download GIF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox title={isInstant ? "Instant conversion" : "About this tool"}>
            {isInstant
              ? "Drop a video and it will be converted to GIF automatically."
              : "Converts video to animated GIF with palette optimization for best quality at small file sizes."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />

          {!isProcessing && (
            <>
              {/* FPS selector */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">Frame Rate</legend>
                <div className="grid grid-cols-4 gap-3" role="group">
                  {FPS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFps(opt.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        fps === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Width selector */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">Width</legend>
                <div className="grid grid-cols-4 gap-3" role="group">
                  {WIDTH_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setWidth(opt.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        width === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} />}

          <button
            type="button"
            onClick={() => processFile(file, { fps, width })}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Converting to GIF... {progress > 0 ? `${Math.round(progress)}%` : ""}
              </>
            ) : (
              <>
                <VideoToGifIcon className="w-5 h-5" />
                Convert to GIF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

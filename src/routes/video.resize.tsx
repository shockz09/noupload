import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/resize")({
	head: () => ({
		meta: [
			{ title: "Resize Video Free - Change Video Resolution | noupload" },
			{ name: "description", content: "Resize video for free. Change resolution and dimensions. Works offline, completely private." },
			{ name: "keywords", content: "resize video, change video size, video resizer, video resolution, scale video" },
			{ property: "og:title", content: "Resize Video Free - Change Video Resolution" },
			{ property: "og:description", content: "Resize video for free. Works 100% offline." },
		],
	}),
	component: ResizeVideoPage,
});

import { useCallback, useState } from "react";
import { VideoResizeIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { analyzeVideo, type VideoInfo } from "@/lib/video/compress";
import { resizeVideo } from "@/lib/video/resize";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";

const SIZE_OPTIONS = [
  { height: 2160, label: "4K (2160p)" },
  { height: 1440, label: "1440p" },
  { height: 1080, label: "1080p" },
  { height: 720, label: "720p" },
  { height: 480, label: "480p" },
  { height: 360, label: "360p" },
];

function ResizeVideoPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [targetHeight, setTargetHeight] = useState(720);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, h: number) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await resizeVideo(f, { height: h }, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to resize video"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setFile(files[0]);
      setResult(null);
      clearError();
      try {
        const info = await analyzeVideo(files[0]);
        setVideoInfo(info);
        // Default to one step down
        const lower = SIZE_OPTIONS.find((s) => s.height < info.height);
        if (lower) setTargetHeight(lower.height);
        if (isInstant && lower) processFile(files[0], lower.height);
      } catch {
        setError("Could not analyze video.");
      }
    },
    [isInstant, processFile, clearError, setError],
  );

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
      sourceToolLabel: "Resize Video",
    });
  }, [result, addToBuffer]);

  const availableSizes = videoInfo ? SIZE_OPTIONS.filter((s) => s.height < videoInfo.height) : SIZE_OPTIONS;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoResizeIcon className="w-7 h-7" />}
        iconClass="tool-video-resize"
        title="Resize Video"
        description="Change video resolution"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Video Resized!"
          subtitle={`${targetHeight}p`}
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Resize Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox>{isInstant ? "Drop a video and it will be resized automatically." : "Resizes your video to a lower resolution. Aspect ratio is preserved."}</InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo
            file={file}
            duration={videoInfo?.duration}
            resolution={videoInfo ? `${videoInfo.width}×${videoInfo.height}` : undefined}
            onClear={handleStartOver}
            icon={<VideoToolIcon className="w-5 h-5" />}
          />
          {videoInfo && !isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Target Resolution</legend>
              <div className="grid grid-cols-3 gap-3" role="group">
                {availableSizes.map((s) => (
                  <button
                    key={s.height}
                    type="button"
                    onClick={() => setTargetHeight(s.height)}
                    className={`p-3 rounded-lg border-2 transition-all text-center ${
                      targetHeight === s.height ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{s.label}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && <ErrorBox message={error} />}
          <button type="button" onClick={() => processFile(file, targetHeight)} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Resizing... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoResizeIcon className="w-5 h-5" />
                Resize to {targetHeight}p
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

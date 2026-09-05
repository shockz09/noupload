import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/speed")({
  head: () => ({
    meta: [
      { title: "Change Video Speed Free - Speed Up or Slow Down Video | noupload" },
      {
        name: "description",
        content:
          "Change video playback speed for free. Speed up or slow down any video from 0.25x to 4x. Works offline in your browser, no uploads.",
      },
      {
        name: "keywords",
        content:
          "change video speed, speed up video, slow down video, video speed changer, slow motion video, timelapse video, free video speed",
      },
      { property: "og:title", content: "Change Video Speed Free - Speed Up or Slow Down Video" },
      { property: "og:description", content: "Speed up or slow down videos for free. Works 100% offline." },
    ],
  }),
  component: SpeedVideoPage,
});

import { useCallback, useState } from "react";
import { VideoSpeedIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { analyzeVideo, type VideoInfo } from "@/lib/video/compress";
import { changeVideoSpeed } from "@/lib/video/speed";

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 3, 4];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SpeedVideoPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [speed, setSpeed] = useState(2);
  const [usedSpeed, setUsedSpeed] = useState(2);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, s: number) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await changeVideoSpeed(f, { speed: s }, (p) => setProgress(p * 100));
        setUsedSpeed(s);
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to change video speed"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      setInfo(null);
      setResult(null);
      clearError();
      // Best-effort: the tool still works without it, the duration preview just stays hidden.
      analyzeVideo(f)
        .then(setInfo)
        .catch(() => {});
      if (isInstant) processFile(f, speed);
    },
    [isInstant, processFile, speed, clearError],
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
    setInfo(null);
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
      sourceToolLabel: "Change Video Speed",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  const duration = info?.duration ?? 0;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoSpeedIcon className="w-7 h-7" />}
        iconClass="tool-video-speed"
        title="Change Video Speed"
        description="Speed up or slow down a video, audio included"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Speed Changed!"
          subtitle={
            duration > 0 ? `${usedSpeed}x speed · ${formatDuration(duration / usedSpeed)}` : `${usedSpeed}x speed`
          }
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Change Another"
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
          <InfoBox>
            {isInstant
              ? "Drop a video and its speed will be changed automatically."
              : "Re-times the video without re-encoding it, so the picture keeps its original quality. Audio is resampled to match, so its pitch shifts like a record played faster or slower."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo
            file={file}
            duration={duration}
            onClear={handleStartOver}
            icon={<VideoToolIcon className="w-5 h-5" />}
          />

          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="input-label">Speed</legend>
              <div className="grid grid-cols-4 gap-2" role="group">
                {SPEED_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    aria-pressed={speed === s}
                    className={`px-2 py-2 text-sm font-bold border-2 border-foreground transition-colors ${
                      speed === s ? "bg-foreground text-background" : "hover:bg-muted"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {duration > 0 && (
            <div className="bg-muted/50 border-2 border-foreground p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Original duration:</span>
                <span className="font-bold">{formatDuration(duration)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">New duration:</span>
                <span className="font-bold">{formatDuration(duration / speed)}</span>
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          <button
            type="button"
            onClick={() => processFile(file, speed)}
            disabled={isProcessing}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Changing speed... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoSpeedIcon className="w-5 h-5" />
                Change Speed to {speed}x
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

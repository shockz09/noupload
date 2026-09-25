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

import { useCallback, useEffect, useRef, useState } from "react";
import { VolumeIcon, MuteIcon } from "@/components/icons/audio";
import { VideoSpeedIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ErrorBox,
  InfoBox,
  PreviewPlayOverlay,
  VideoFileInfo,
  VideoPageHeader,
  VideoResultView,
} from "@/components/video/shared";
import { useFileBuffer, useFileProcessing, useObjectURL } from "@/hooks";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";
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

/**
 * The source video playing at the chosen speed, so the result can be judged
 * before anything is processed. The element's own playbackRate and
 * preservesPitch match what the export does to the frames and the audio, and
 * the clock reads in the output's time.
 */
function SpeedPreview({
  url,
  speed,
  preservePitch,
  paused,
}: {
  url: string;
  speed: number;
  preservePitch: boolean;
  paused: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [aspect, setAspect] = useState("16 / 9");
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const apply = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    v.preservesPitch = preservePitch;
  }, [speed, preservePitch]);

  useEffect(apply, [apply]);

  useEffect(() => {
    if (paused) videoRef.current?.pause();
  }, [paused]);

  // Follow the playhead every frame; timeupdate only fires a few times a second.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (clientX: number) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !duration) return;
    const r = bar.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  };

  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(e.clientX);
  };

  if (failed) {
    return (
      <div className="border-2 border-dashed border-foreground/40 p-6 text-center text-xs text-muted-foreground">
        This browser can't play the file, but it can still change its speed.
      </div>
    );
  }

  const pct = duration ? (time / duration) * 100 : 0;
  return (
    <div className="space-y-2">
      <div
        className="relative h-64 sm:h-72 max-w-full mx-auto border-2 border-foreground bg-foreground overflow-hidden"
        style={{ aspectRatio: aspect }}
      >
        <video
          ref={videoRef}
          src={url}
          autoPlay
          loop
          muted={muted}
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setAspect(`${v.videoWidth} / ${v.videoHeight}`);
            setDuration(v.duration);
            // Loading a source resets the element's rate.
            apply();
          }}
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-contain"
        />
        <PreviewPlayOverlay videoRef={videoRef} />
        <span className="pointer-events-none absolute left-2 top-2 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground border-2 border-foreground">
          Preview · {speed}x
        </span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn preview sound on" : "Mute preview"}
          title={muted ? "Hear it" : "Mute"}
          className={`absolute right-2 top-2 h-8 px-2 inline-flex items-center gap-1.5 text-xs font-bold border-2 border-foreground transition-colors ${
            muted ? "bg-background hover:bg-accent" : "bg-foreground text-background"
          }`}
        >
          {muted ? <MuteIcon className="w-4 h-4" /> : <VolumeIcon className="w-4 h-4" />}
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label="Preview position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration / speed)}
          aria-valuenow={Math.round(time / speed)}
          onPointerDown={onBarDown}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e.clientX);
          }}
          onKeyDown={(e) => {
            const v = videoRef.current;
            if (!v || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
            e.preventDefault();
            // One second of the result per press.
            const step = e.key === "ArrowRight" ? speed : -speed;
            v.currentTime = Math.max(0, Math.min(duration, v.currentTime + step));
          }}
          className="relative flex-1 h-3 border-2 border-foreground bg-background cursor-pointer touch-none"
        >
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-mono font-bold tabular-nums whitespace-nowrap">
          {formatDuration(time / speed)} / {formatDuration(duration / speed)}
        </span>
      </div>
    </div>
  );
}

function SpeedVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [speed, setSpeed] = useState(2);
  const [preservePitch, setPreservePitch] = useState(true);
  const [usedSpeed, setUsedSpeed] = useState(2);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();
  const { url: previewUrl, setSource: setPreview, revoke: revokePreview } = useObjectURL();

  const processFile = useCallback(
    async (f: File, s: number, keepPitch: boolean) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await changeVideoSpeed(f, { speed: s, preservePitch: keepPitch }, (p) => setProgress(p * 100));
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
      setPreview(f);
      setInfo(null);
      setResult(null);
      clearError();
      // Best-effort: the tool still works without it, the duration preview just stays hidden.
      analyzeVideo(f)
        .then(setInfo)
        .catch(() => {});
    },
    [clearError, setPreview],
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
    revokePreview();
    setFile(null);
    setInfo(null);
    setResult(null);
    clearError();
  }, [clearError, revokePreview]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "video/mp4",
      size: result.blob.size,
      fileType: "video",
      sourceToolLabel: "Change Video Speed",
    });
  }, [result, addToBuffer]);

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
            maxSize={VIDEO_MAX_FILE_SIZE}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox>
            Re-times the video without re-encoding it, so the picture keeps its original quality. You can watch and
            hear the new speed before you process it, with the audio at its normal pitch or shifted like a record.
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

          {previewUrl && (
            <SpeedPreview
              key={previewUrl}
              url={previewUrl}
              speed={speed}
              preservePitch={preservePitch}
              paused={isProcessing}
            />
          )}

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

          {!isProcessing && (
            <label className="flex items-start gap-3 border-2 border-foreground p-3 cursor-pointer hover:bg-muted transition-colors">
              <input
                type="checkbox"
                checked={preservePitch}
                onChange={(e) => setPreservePitch(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-foreground shrink-0"
              />
              <span className="text-sm">
                <span className="font-bold">Keep the original pitch</span>
                <span className="block text-muted-foreground">
                  Voices and music stay at their normal pitch. Uncheck for the tape effect, where speeding up sounds
                  higher.
                </span>
              </span>
            </label>
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
            onClick={() => processFile(file, speed, preservePitch)}
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

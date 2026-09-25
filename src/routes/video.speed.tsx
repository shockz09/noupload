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
import { MuteIcon, VolumeIcon } from "@/components/icons/audio";
import { PauseIcon, PlayIcon } from "@/components/icons/ui";
import { VideoSpeedIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ErrorBox,
  InfoBox,
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
 * before anything is processed. The element's playbackRate (with its default
 * pitch correction) matches what the export does to the frames and the audio,
 * and the clock reads in the output's time. Controls sit in a bar under the
 * video so nothing covers the picture, whatever its shape.
 */
function SpeedPreview({ url, speed, paused }: { url: string; speed: number; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (paused) videoRef.current?.pause();
  }, [paused]);

  // Follow the playhead every frame while playing; timeupdate only fires a few times a second.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (videoRef.current) setTime(videoRef.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seek = (clientX: number) => {
    const v = videoRef.current;
    const bar = barRef.current;
    if (!v || !bar || !duration) return;
    const r = bar.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
    setTime(v.currentTime);
  };

  if (failed) {
    return (
      <div className="border-2 border-dashed border-foreground/40 p-6 text-center text-xs text-muted-foreground">
        This browser can't play the file, but it can still change its speed.
      </div>
    );
  }

  const pct = duration ? (time / duration) * 100 : 0;
  const square = "w-9 h-9 shrink-0 flex items-center justify-center border-2 border-foreground transition-colors";
  return (
    <div className="border-2 border-foreground bg-card">
      <div className="relative h-64 sm:h-80 bg-foreground">
        <video
          ref={videoRef}
          src={url}
          autoPlay
          loop
          muted={muted}
          playsInline
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            // Loading a source resets the element's rate.
            e.currentTarget.playbackRate = speed;
          }}
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-2 p-2 border-t-2 border-foreground">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className={`${square} ${playing ? "bg-background hover:bg-accent" : "bg-primary text-primary-foreground"}`}
        >
          {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 translate-x-px" />}
        </button>
        <span className="shrink-0 px-2 h-9 flex items-center border-2 border-foreground bg-foreground text-background text-xs font-mono font-bold tabular-nums">
          {speed}x
        </span>
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label="Preview position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration / speed)}
          aria-valuenow={Math.round(time / speed)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seek(e.clientX);
          }}
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
            setTime(v.currentTime);
          }}
          className="relative flex-1 min-w-0 h-4 border-2 border-foreground bg-background cursor-pointer touch-none"
        >
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-mono font-bold tabular-nums">
          {formatDuration(time / speed)} / {formatDuration(duration / speed)}
        </span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          title={muted ? "Unmute" : "Mute"}
          className={`${square} ${muted ? "bg-background hover:bg-accent" : "bg-foreground text-background"}`}
        >
          {muted ? <MuteIcon className="w-4 h-4" /> : <VolumeIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SpeedVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [speed, setSpeed] = useState(2);
  const [usedSpeed, setUsedSpeed] = useState(2);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();
  const { url: previewUrl, setSource: setPreview, revoke: revokePreview } = useObjectURL();

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
            Re-times the video without re-encoding it, so the picture keeps its original quality. Voices and music
            keep their normal pitch, and you can watch and hear the new speed before you process it.
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

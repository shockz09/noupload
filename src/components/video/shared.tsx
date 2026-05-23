
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DownloadIcon, PlayIcon, PauseIcon } from "@/components/icons/ui";
import { VolumeIcon } from "@/components/icons/audio";
import { VideoToolIcon } from "@/components/icons/video";
import { FileInfo, PageHeader } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { formatFileSize } from "@/lib/utils";

// Re-export common components
export { ErrorBox, ProcessButton, SuccessCard, InfoBox, ProgressBar } from "@/components/shared";

// ============ Video Preview Player ============

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const VideoPreview = memo(function VideoPreview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [idle, setIdle] = useState(false);

  const vidRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  // Hide controls after inactivity while playing
  const resetIdle = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    if (playing) {
      idleTimer.current = setTimeout(() => setIdle(true), 2500);
    }
  }, [playing]);

  useEffect(() => {
    if (playing) resetIdle();
    else setIdle(false);
    return () => clearTimeout(idleTimer.current);
  }, [playing, resetIdle]);

  const toggle = useCallback(() => {
    if (!vidRef.current) return;
    if (playing) {
      vidRef.current.pause();
    } else {
      vidRef.current.play();
    }
    resetIdle();
  }, [playing, resetIdle]);

  const onTimeUpdate = useCallback(() => {
    if (vidRef.current && !seeking) setCurrent(vidRef.current.currentTime);
  }, [seeking]);

  const onLoaded = useCallback(() => {
    if (vidRef.current) setDuration(vidRef.current.duration);
  }, []);

  // Seek via progress bar
  const seekFromEvent = useCallback(
    (clientX: number) => {
      if (!progressRef.current || !vidRef.current || duration === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
      const t = pct * duration;
      vidRef.current.currentTime = t;
      setCurrent(t);
    },
    [duration],
  );

  const onProgressDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setSeeking(true);
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekFromEvent(e.clientX);
    const onUp = () => setSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [seeking, seekFromEvent]);

  const toggleMute = useCallback(() => {
    if (!vidRef.current) return;
    const next = !muted;
    vidRef.current.muted = next;
    setMuted(next);
  }, [muted]);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!vidRef.current) return;
    const v = Number(e.target.value);
    vidRef.current.volume = v;
    setVolume(v);
    if (v === 0) setMuted(true);
    else setMuted(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!vidRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      vidRef.current.requestFullscreen?.();
    }
  }, []);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showControls = !idle || hovered || !playing;

  if (!url) return null;

  return (
    <div
      className="relative border-2 border-foreground bg-black group"
      onMouseEnter={() => {
        setHovered(true);
        resetIdle();
      }}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={resetIdle}
    >
      {/* Video element */}
      <video
        ref={vidRef}
        src={url}
        playsInline
        className="w-full max-h-72 object-contain cursor-pointer"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoaded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Big center play button when paused */}
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <PlayIcon className="w-6 h-6 text-black ml-0.5" />
          </div>
        </button>
      )}

      {/* Bottom controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-3 transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-1.5 bg-white/20 cursor-pointer mb-2.5 group/progress hover:h-2.5 transition-all"
          onMouseDown={onProgressDown}
        >
          {/* Buffered / played */}
          <div
            className="absolute top-0 left-0 bottom-0 bg-white"
            style={{ width: `${pct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${pct}% - 6px)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Play/pause */}
          <button type="button" onClick={toggle} className="text-white hover:text-white/80 p-0.5">
            {playing ? <PauseIcon className="w-4.5 h-4.5" /> : <PlayIcon className="w-4.5 h-4.5 ml-0.5" />}
          </button>

          {/* Time */}
          <span className="text-white/90 text-xs font-mono tabular-nums">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button type="button" onClick={toggleMute} className="text-white hover:text-white/80 p-0.5">
              {muted || volume === 0 ? (
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <VolumeIcon className="w-4.5 h-4.5" />
              )}
            </button>
            {showVolume && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={changeVolume}
                className="w-16 h-1 ml-1.5 accent-white"
              />
            )}
          </div>

          {/* Fullscreen */}
          <button type="button" onClick={toggleFullscreen} className="text-white hover:text-white/80 p-0.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

// ============ Video Result View ============
// Replaces SuccessCard for video tools: player hero + compact action bar

interface VideoResultProps {
  blob: Blob;
  title: string;
  subtitle?: string;
  downloadLabel: string;
  onDownload: (e: React.MouseEvent) => void;
  onHoldInBuffer?: () => void;
  onStartOver: () => void;
  startOverLabel: string;
  children?: ReactNode; // extra info (e.g. ComparisonDisplay for compress)
}

export const VideoResultView = memo(function VideoResultView({
  blob,
  title,
  subtitle,
  downloadLabel,
  onDownload,
  onHoldInBuffer,
  onStartOver,
  startOverLabel,
  children,
}: VideoResultProps) {
  const { isInstant } = useInstantMode();
  const bufferedRef = useRef(false);
  useEffect(() => {
    if (isInstant && onHoldInBuffer && !bufferedRef.current) {
      bufferedRef.current = true;
      onHoldInBuffer();
    }
  }, [isInstant, onHoldInBuffer]);

  return (
    <div className="animate-fade-up space-y-0">
      {/* Video player — full width, no card wrapper */}
      <VideoPreview blob={blob} />

      {/* Action bar */}
      <div className="border-2 border-t-0 border-foreground bg-background p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {children}
            <span className="text-xs font-mono text-muted-foreground">
              {formatFileSize(blob.size)}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button type="button" onClick={onDownload} className="btn-success flex-1">
            <DownloadIcon className="w-4 h-4 shrink-0" />
            {downloadLabel}
          </button>
          <button type="button" onClick={onStartOver} className="btn-secondary">
            {startOverLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// ============ Video Page Header ============
interface VideoPageHeaderProps {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export const VideoPageHeader = memo(function VideoPageHeader({
  icon,
  iconClass,
  title,
  description,
}: VideoPageHeaderProps) {
  return (
    <PageHeader
      icon={icon}
      iconClass={iconClass}
      title={title}
      description={description}
      backHref="/"
      backLabel="Back to Video Tools"
      tabKey="video"
    />
  );
});

// ============ Video File Info ============
interface VideoFileInfoProps {
  file: File;
  duration?: number;
  resolution?: string;
  onClear: () => void;
  icon?: ReactNode;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoFileInfo = memo(function VideoFileInfo({
  file,
  duration,
  resolution,
  onClear,
  icon,
}: VideoFileInfoProps) {
  const parts = [formatFileSize(file.size)];
  if (duration && duration > 0) parts.unshift(formatDuration(duration));
  if (resolution) parts.push(resolution);

  return (
    <FileInfo
      file={file}
      fileSize={parts.join(" · ")}
      onClear={onClear}
      icon={icon || <VideoToolIcon className="w-5 h-5 shrink-0" />}
    />
  );
});

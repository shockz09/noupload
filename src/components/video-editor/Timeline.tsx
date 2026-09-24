// Multi-track timeline: ruler, track headers, clips with move/trim, playhead.

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { MuteIcon, VolumeIcon } from "@/components/icons/audio";
import { EyeIcon, EyeOffIcon, XIcon } from "@/components/icons/ui";
import {
  type Clip,
  type MediaItem,
  type Project,
  type Track,
  MIN_CLIP,
  clipEnd,
  findFreeStart,
  maxSourceLength,
  neighbourBounds,
  projectDuration,
  snap,
  trackKindFor,
} from "@/lib/video/editor/model";

export const TRACK_HEADER_W = 132;
const RULER_H = 28;
const SNAP_PX = 8;

const ROW_H: Record<Track["kind"], number> = { video: 60, audio: 48, text: 36 };

export interface Gesture {
  begin: () => Project;
  live: (p: Project) => void;
  end: () => void;
}

interface TimelineProps {
  project: Project;
  media: Map<string, MediaItem>;
  time: number;
  playing: boolean;
  pps: number;
  selectedId: string | null;
  gesture: Gesture;
  onSeek: (t: number) => void;
  onSelect: (id: string | null) => void;
  onToggleTrack: (trackId: string, key: "muted" | "hidden") => void;
  onRemoveTrack: (trackId: string) => void;
  onDropMedia: (mediaId: string, trackId: string, t: number) => void;
  onZoom: (pps: number) => void;
}

export function fmtTime(s: number, fps?: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const base = `${m}:${sec.toString().padStart(2, "0")}`;
  if (!fps) return base;
  const f = Math.floor((s % 1) * fps + 1e-6);
  return `${base}:${f.toString().padStart(2, "0")}`;
}

function tickStep(pps: number) {
  for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (s * pps >= 70) return s;
  return 600;
}

/** Which kinds of track a clip may live on. */
function acceptsClip(track: Track, clip: Clip, media: Map<string, MediaItem>, from: Track | undefined) {
  if (clip.type === "text") return track.kind === "text";
  const item = media.get(clip.mediaId);
  if (!item) return false;
  // Clips stay within the kind of track they started on (a detached video's audio stays on audio tracks).
  return from ? track.kind === from.kind : track.kind === trackKindFor(item.kind);
}

export const Timeline = memo(function Timeline({
  project,
  media,
  time,
  playing,
  pps,
  selectedId,
  gesture,
  onSeek,
  onSelect,
  onToggleTrack,
  onRemoveTrack,
  onDropMedia,
  onZoom,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const duration = projectDuration(project);
  const contentW = Math.max(1200, (duration + 30) * pps);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = lanesRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, (clientX - rect.left) / pps);
    },
    [pps],
  );

  const trackAtClientY = useCallback(
    (clientY: number): string | null => {
      const rows = lanesRef.current?.querySelectorAll<HTMLElement>("[data-track-id]");
      if (!rows) return null;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (clientY >= r.top && clientY < r.bottom) return row.dataset.trackId ?? null;
      }
      return null;
    },
    [],
  );

  // ── Ruler / empty-lane scrubbing ───────────────────────────
  const onScrubDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onSelect(null);
      onSeek(timeFromClientX(e.clientX));
      const move = (ev: PointerEvent) => onSeek(timeFromClientX(ev.clientX));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onSeek, onSelect, timeFromClientX],
  );

  // ── Clip move / trim ───────────────────────────────────────
  const onClipDown = useCallback(
    (e: React.PointerEvent, clip: Clip, mode: "move" | "start" | "end") => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect(clip.id);
      const base = gesture.begin();
      const orig = base.clips.find((c) => c.id === clip.id)!;
      const fromTrack = base.tracks.find((t) => t.id === orig.trackId);
      const item = orig.type === "media" ? media.get(orig.mediaId) : undefined;
      const x0 = e.clientX;
      const threshold = SNAP_PX / pps;
      const edges = [0, time, ...base.clips.filter((c) => c.id !== orig.id).flatMap((c) => [c.start, clipEnd(c)])];
      const { lo, hi } = neighbourBounds(base, orig);
      let moved = false;

      const move = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientX - x0) < 3 && mode === "move") {
          const overTrack = trackAtClientY(ev.clientY);
          if (!overTrack || overTrack === orig.trackId) return;
        }
        moved = true;
        const dt = (ev.clientX - x0) / pps;
        let next: Clip;

        if (mode === "move") {
          let start = orig.start + dt;
          const snappedStart = snap(start, edges, threshold);
          const snappedEnd = snap(start + orig.duration, edges, threshold);
          if (snappedStart !== start) start = snappedStart;
          else if (snappedEnd !== start + orig.duration) start = snappedEnd - orig.duration;
          const overId = trackAtClientY(ev.clientY);
          const over = base.tracks.find((t) => t.id === overId);
          const trackId = over && acceptsClip(over, orig, media, fromTrack) ? over.id : orig.trackId;
          start = findFreeStart(base, trackId, Math.max(0, start), orig.duration, orig.id);
          next = { ...orig, start, trackId };
        } else if (mode === "start") {
          const sourceLo = orig.type === "media" && item && item.kind !== "image" ? orig.start - orig.in : 0;
          let start = snap(orig.start + dt, edges, threshold);
          start = Math.min(Math.max(start, lo, sourceLo, 0), clipEnd(orig) - MIN_CLIP);
          const shift = start - orig.start;
          next =
            orig.type === "media"
              ? { ...orig, start, duration: orig.duration - shift, in: orig.in + shift }
              : { ...orig, start, duration: orig.duration - shift };
        } else {
          let end = snap(clipEnd(orig) + dt, edges, threshold);
          end = Math.max(orig.start + MIN_CLIP, Math.min(end, hi, orig.start + maxSourceLength(orig, item)));
          next = { ...orig, duration: end - orig.start };
        }
        gesture.live({ ...base, clips: base.clips.map((c) => (c.id === orig.id ? next : c)) });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        gesture.end();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [gesture, media, onSelect, pps, time, trackAtClientY],
  );

  // ── Drag from media bin ────────────────────────────────────
  const onLaneDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-editor-media")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onLaneDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      const id = e.dataTransfer.getData("application/x-editor-media");
      if (!id) return;
      e.preventDefault();
      onDropMedia(id, trackId, timeFromClientX(e.clientX));
    },
    [onDropMedia, timeFromClientX],
  );

  // ── Ctrl/⌘ + wheel zooms around the pointer ────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const next = Math.min(400, Math.max(4, pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const rect = el.getBoundingClientRect();
      const anchorT = (el.scrollLeft + e.clientX - rect.left) / pps;
      onZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = anchorT * next - (e.clientX - rect.left);
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [pps, onZoom]);

  // Keep the playhead in view while playback carries it off-screen.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const x = time * pps;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 80);
  }, [time, pps, playing]);

  const step = tickStep(pps);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t * pps <= contentW; t += step) out.push(t);
    return out;
  }, [pps, contentW, step]);

  return (
    <div className="h-full bg-card select-none">
      <div className="h-full flex overflow-y-auto">
        {/* Track headers */}
        <div className="shrink-0 border-r-2 border-foreground bg-muted self-start min-h-full" style={{ width: TRACK_HEADER_W }}>
          <div style={{ height: RULER_H }} className="sticky top-0 z-30 border-b-2 border-foreground bg-muted" />
          {project.tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              empty={!project.clips.some((c) => c.trackId === track.id)}
              onToggle={onToggleTrack}
              onRemove={onRemoveTrack}
            />
          ))}
        </div>

        {/* Lanes */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-visible self-start min-h-full">
          <div ref={lanesRef} className="relative min-h-full" style={{ width: contentW }}>
            {/* Ruler */}
            <div
              className="sticky top-0 z-30 border-b-2 border-foreground bg-muted cursor-pointer"
              style={{ height: RULER_H }}
              onPointerDown={onScrubDown}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 bottom-0 border-l border-foreground/30" style={{ left: t * pps }}>
                  <span className="absolute left-1 top-1 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {fmtTime(t)}
                  </span>
                </div>
              ))}
            </div>

            {project.tracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                className={`relative border-b border-foreground/20 ${track.hidden || track.muted ? "opacity-50" : ""}`}
                style={{ height: ROW_H[track.kind] }}
                onPointerDown={onScrubDown}
                onDragOver={onLaneDragOver}
                onDrop={(e) => onLaneDrop(e, track.id)}
              >
                {project.clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <ClipView
                      key={clip.id}
                      clip={clip}
                      item={clip.type === "media" ? media.get(clip.mediaId) : undefined}
                      track={track}
                      pps={pps}
                      selected={clip.id === selectedId}
                      onDown={onClipDown}
                    />
                  ))}
              </div>
            ))}

            {project.clips.length === 0 && (
              <div
                className="absolute left-4 pointer-events-none text-xs font-bold text-muted-foreground border-2 border-dashed border-foreground/30 px-3 py-2 bg-background/80"
                style={{ top: RULER_H + 12 }}
              >
                Drag media from the left onto a track to start
              </div>
            )}

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 pointer-events-none z-20" style={{ left: time * pps }}>
              <div className="absolute -left-[6px] top-0 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-red-500" />
              <div className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const TrackHeader = memo(function TrackHeader({
  track,
  empty,
  onToggle,
  onRemove,
}: {
  track: Track;
  empty: boolean;
  onToggle: (id: string, key: "muted" | "hidden") => void;
  onRemove: (id: string) => void;
}) {
  const btn = "w-7 h-7 border-2 border-foreground flex items-center justify-center transition-colors";
  const off = "bg-foreground text-background";
  const on = "bg-card hover:bg-muted";
  return (
    <div
      className="flex items-center gap-1 px-2 border-b border-foreground/20 group"
      style={{ height: ROW_H[track.kind] }}
    >
      <span className="flex-1 truncate text-xs font-bold uppercase tracking-wide">{track.name}</span>
      {track.kind !== "audio" && (
        <button
          type="button"
          title={track.hidden ? "Show track" : "Hide track"}
          onClick={() => onToggle(track.id, "hidden")}
          className={`${btn} ${track.hidden ? off : on}`}
        >
          {track.hidden ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
        </button>
      )}
      {track.kind !== "text" && (
        <button
          type="button"
          title={track.muted ? "Unmute track" : "Mute track"}
          onClick={() => onToggle(track.id, "muted")}
          className={`${btn} ${track.muted ? off : on}`}
        >
          {track.muted ? <MuteIcon className="w-3.5 h-3.5" /> : <VolumeIcon className="w-3.5 h-3.5" />}
        </button>
      )}
      {empty && (
        <button
          type="button"
          title="Remove track"
          onClick={() => onRemove(track.id)}
          className={`${btn} ${on} hidden group-hover:flex hover:!bg-destructive hover:text-white`}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

const CLIP_COLORS: Record<string, string> = {
  video: "bg-sky-200 dark:bg-sky-900",
  image: "bg-violet-200 dark:bg-violet-900",
  audio: "bg-emerald-200 dark:bg-emerald-900",
  text: "bg-amber-200 dark:bg-amber-900",
  missing: "bg-muted",
};

const ClipView = memo(function ClipView({
  clip,
  item,
  track,
  pps,
  selected,
  onDown,
}: {
  clip: Clip;
  item: MediaItem | undefined;
  track: Track;
  pps: number;
  selected: boolean;
  onDown: (e: React.PointerEvent, clip: Clip, mode: "move" | "start" | "end") => void;
}) {
  const width = Math.max(4, clip.duration * pps);
  const colorKey =
    clip.type === "text" ? "text" : !item ? "missing" : track.kind === "audio" ? "audio" : item.kind;
  const label = clip.type === "text" ? clip.text.split("\n")[0] || "Text" : (item?.name ?? "Missing media");
  const sourceW = item && item.kind !== "image" ? item.duration * pps : 0;
  const offset = clip.type === "media" ? clip.in * pps : 0;

  return (
    <div
      className={`absolute top-1 bottom-1 overflow-hidden border-2 cursor-grab active:cursor-grabbing ${CLIP_COLORS[colorKey]} ${
        selected ? "border-yellow-400 ring-2 ring-yellow-400 z-10" : "border-foreground"
      }`}
      style={{ left: clip.start * pps, width }}
      onPointerDown={(e) => onDown(e, clip, "move")}
    >
      {/* Content */}
      {clip.type === "media" && item && track.kind !== "audio" && item.kind === "video" && item.thumbs.length > 0 && (
        <div className="absolute inset-y-0 flex pointer-events-none opacity-80" style={{ left: -offset, width: sourceW }}>
          {item.thumbs.map((src, i) =>
            src ? (
              <img key={i} src={src} alt="" draggable={false} className="h-full flex-1 min-w-0 object-cover" />
            ) : (
              <div key={i} className="h-full flex-1" />
            ),
          )}
        </div>
      )}
      {clip.type === "media" && item?.kind === "image" && (
        <div
          className="absolute inset-0 pointer-events-none opacity-80 bg-repeat-x"
          style={{ backgroundImage: `url(${item.url})`, backgroundSize: "auto 100%" }}
        />
      )}
      {clip.type === "media" && item && (track.kind === "audio" || item.kind === "audio") && item.peaks.length > 0 && (
        <Waveform peaks={item.peaks} left={-offset} width={sourceW} />
      )}
      {clip.type === "media" && (clip.fadeIn > 0 || clip.fadeOut > 0) && (
        <>
          {clip.fadeIn > 0 && (
            <div
              className="absolute inset-y-0 left-0 pointer-events-none bg-gradient-to-r from-black/50 to-transparent"
              style={{ width: clip.fadeIn * pps }}
            />
          )}
          {clip.fadeOut > 0 && (
            <div
              className="absolute inset-y-0 right-0 pointer-events-none bg-gradient-to-l from-black/50 to-transparent"
              style={{ width: clip.fadeOut * pps }}
            />
          )}
        </>
      )}
      <span className="absolute left-2 top-0.5 right-2 truncate text-[11px] font-bold text-foreground drop-shadow-[0_0_2px_var(--background)] pointer-events-none">
        {label}
      </span>

      {/* Trim handles */}
      <div
        className="absolute left-0 inset-y-0 w-2 cursor-ew-resize hover:bg-foreground/30"
        onPointerDown={(e) => onDown(e, clip, "start")}
      />
      <div
        className="absolute right-0 inset-y-0 w-2 cursor-ew-resize hover:bg-foreground/30"
        onPointerDown={(e) => onDown(e, clip, "end")}
      />
    </div>
  );
});

const Waveform = memo(function Waveform({ peaks, left, width }: { peaks: number[]; left: number; width: number }) {
  const d = useMemo(() => {
    let path = "";
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * 46);
      path += `M${i + 0.5} ${50 - h}V${50 + h}`;
    }
    return path;
  }, [peaks]);
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-y-0 pointer-events-none text-foreground/50"
      style={{ left, width, height: "100%" }}
      viewBox={`0 0 ${peaks.length} 100`}
      preserveAspectRatio="none"
    >
      <path d={d} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
});

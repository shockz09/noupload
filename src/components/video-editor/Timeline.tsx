// Multi-track timeline: ruler with markers, track headers, clips with move/trim,
// multi-select (shift/⌘-click or drag a box on empty space), playhead.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MuteIcon, VolumeIcon } from "@/components/icons/audio";
import { EyeIcon, EyeOffIcon, XIcon } from "@/components/icons/ui";
import {
  type Clip,
  clipEnd,
  findFreeStart,
  keyframeTimes,
  type MediaItem,
  MIN_CLIP,
  maxSourceLength,
  neighbourBounds,
  type Project,
  projectDuration,
  snap,
  type Track,
  trackKindFor,
  withLinked,
} from "@/lib/video/editor/model";

export const TRACK_HEADER_W = 132;
const RULER_H = 28;
const SNAP_PX = 8;
const DRAG_PX = 3;
const EPS = 1e-3;

const ROW_H: Record<Track["kind"], number> = { video: 60, audio: 48, text: 36 };

export interface Gesture {
  begin: () => Project;
  live: (p: Project) => void;
  end: () => void;
}

export type TimelineTarget =
  | { kind: "clip"; clipId: string }
  | { kind: "lane"; trackId: string; time: number }
  | { kind: "track"; trackId: string }
  | { kind: "marker"; markerId: string };

interface TimelineProps {
  project: Project;
  media: Map<string, MediaItem>;
  time: number;
  playing: boolean;
  pps: number;
  selection: Set<string>;
  primaryId: string | null;
  gesture: Gesture;
  onSeek: (t: number) => void;
  onSelect: (ids: Iterable<string>, primary: string | null) => void;
  onToggleTrack: (trackId: string, key: "muted" | "hidden") => void;
  onRemoveTrack: (trackId: string) => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onDropMedia: (mediaId: string, trackId: string, t: number) => void;
  onZoom: (pps: number) => void;
  onMenu: (target: TimelineTarget, x: number, y: number) => void;
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

/** Whether moving `moving` by `dt` keeps every track free of overlaps. */
function fits(p: Project, moving: Set<string>, dt: number) {
  for (const c of p.clips) {
    if (!moving.has(c.id)) continue;
    const s = c.start + dt;
    if (s < -EPS) return false;
    const e = s + c.duration;
    for (const o of p.clips) {
      if (moving.has(o.id) || o.trackId !== c.trackId) continue;
      if (s < clipEnd(o) - EPS && e > o.start + EPS) return false;
    }
  }
  return true;
}

export const Timeline = memo(function Timeline({
  project,
  media,
  time,
  playing,
  pps,
  selection,
  primaryId,
  gesture,
  onSeek,
  onSelect,
  onToggleTrack,
  onRemoveTrack,
  onRenameTrack,
  onDropMedia,
  onZoom,
  onMenu,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const duration = projectDuration(project);
  const contentW = Math.max(1200, (duration + 30) * pps);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = lanesRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, (clientX - rect.left) / pps);
    },
    [pps],
  );

  const trackAtClientY = useCallback((clientY: number): string | null => {
    const rows = lanesRef.current?.querySelectorAll<HTMLElement>("[data-track-id]");
    if (!rows) return null;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return row.dataset.trackId ?? null;
    }
    return null;
  }, []);

  // ── Ruler scrubbing ────────────────────────────────────────
  const onRulerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      onSeek(timeFromClientX(e.clientX));
      const move = (ev: PointerEvent) => onSeek(timeFromClientX(ev.clientX));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onSeek, timeFromClientX],
  );

  // ── Empty lane: click seeks, drag draws a selection box ────
  const onLaneDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const lanes = lanesRef.current;
      if (!lanes) return;
      const origin = lanes.getBoundingClientRect();
      const x0 = e.clientX - origin.left;
      const y0 = e.clientY - origin.top;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const before = additive ? [...selection] : [];
      let boxing = false;
      const move = (ev: PointerEvent) => {
        const r = lanes.getBoundingClientRect();
        const x1 = ev.clientX - r.left;
        const y1 = ev.clientY - r.top;
        if (!boxing && Math.hypot(x1 - x0, y1 - y0) < DRAG_PX * 2) return;
        boxing = true;
        setMarquee({ x0, y0, x1, y1 });
        const t0 = Math.min(x0, x1) / pps;
        const t1 = Math.max(x0, x1) / pps;
        const top = Math.min(y0, y1) + r.top;
        const bottom = Math.max(y0, y1) + r.top;
        const rows = lanes.querySelectorAll<HTMLElement>("[data-track-id]");
        const tracks = new Set<string>();
        for (const row of rows) {
          const rr = row.getBoundingClientRect();
          if (rr.bottom > top && rr.top < bottom) tracks.add(row.dataset.trackId!);
        }
        const hit = project.clips
          .filter((c) => tracks.has(c.trackId) && c.start < t1 && clipEnd(c) > t0)
          .map((c) => c.id);
        const ids = [...new Set([...before, ...hit])];
        onSelect(ids, ids[ids.length - 1] ?? null);
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setMarquee(null);
        if (!boxing) {
          if (!additive) onSelect([], null);
          onSeek(timeFromClientX(ev.clientX));
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onSeek, onSelect, pps, project.clips, selection, timeFromClientX],
  );

  // ── Clip select / move / trim ──────────────────────────────
  const onClipDown = useCallback(
    (e: React.PointerEvent, clip: Clip, mode: "move" | "start" | "end") => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const solo = e.altKey; // ⌥ works on one clip of a linked group
      const own = solo ? new Set([clip.id]) : withLinked(project, [clip.id]);

      if (mode === "move" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
        const next = new Set(selection);
        const adding = !next.has(clip.id);
        for (const id of own) adding ? next.add(id) : next.delete(id);
        onSelect(next, adding ? clip.id : ([...next].pop() ?? null));
        return;
      }

      const wasSelected = selection.has(clip.id);
      const ids = mode === "move" && wasSelected && !solo ? withLinked(project, selection) : own;
      onSelect(ids, clip.id);

      const base = gesture.begin();
      const orig = base.clips.find((c) => c.id === clip.id)!;
      const fromTrack = base.tracks.find((t) => t.id === orig.trackId);
      const x0 = e.clientX;
      const threshold = SNAP_PX / pps;
      const moving = new Set(ids);
      const edges = [
        0,
        time,
        ...base.markers.map((m) => m.time),
        ...base.clips.filter((c) => !moving.has(c.id)).flatMap((c) => [c.start, clipEnd(c)]),
      ];
      // Partners trimmed alongside: linked clips whose dragged edge lines up with this one's.
      const trimmed =
        mode === "move"
          ? []
          : base.clips.filter(
              (c) =>
                own.has(c.id) &&
                (mode === "start" ? Math.abs(c.start - orig.start) < EPS : Math.abs(clipEnd(c) - clipEnd(orig)) < EPS),
            );
      let moved = false;

      const move = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientX - x0) < DRAG_PX) {
          if (mode !== "move" || moving.size > 1) return;
          const overTrack = trackAtClientY(ev.clientY);
          if (!overTrack || overTrack === orig.trackId) return;
        }
        moved = true;
        let dt = (ev.clientX - x0) / pps;

        if (mode === "move") {
          const s = orig.start + dt;
          const ss = snap(s, edges, threshold);
          const se = snap(s + orig.duration, edges, threshold);
          if (ss !== s) dt = ss - orig.start;
          else if (se !== s + orig.duration) dt = se - orig.duration - orig.start;

          if (moving.size === 1) {
            const overId = trackAtClientY(ev.clientY);
            const over = base.tracks.find((t) => t.id === overId);
            const trackId = over && acceptsClip(over, orig, media, fromTrack) ? over.id : orig.trackId;
            const start = findFreeStart(base, trackId, Math.max(0, orig.start + dt), orig.duration, orig.id);
            gesture.live({ ...base, clips: base.clips.map((c) => (c.id === orig.id ? { ...c, start, trackId } : c)) });
            return;
          }
          // A group keeps its shape: it may jump to any spot where all of it fits,
          // otherwise it slides as far as the gaps around it allow.
          if (!fits(base, moving, dt)) {
            let lo = Number.NEGATIVE_INFINITY;
            let hi = Number.POSITIVE_INFINITY;
            for (const c of base.clips) {
              if (!moving.has(c.id)) continue;
              const b = neighbourBounds(base, c, moving);
              lo = Math.max(lo, b.lo - c.start);
              hi = Math.min(hi, b.hi - clipEnd(c));
            }
            dt = Math.min(Math.max(dt, lo), hi);
          }
          gesture.live({
            ...base,
            clips: base.clips.map((c) => (moving.has(c.id) ? { ...c, start: c.start + dt } : c)),
          });
          return;
        }

        // Trims: every partner on the same edge gets the same cut, limited by all of them.
        const trimSet = new Set(trimmed.map((c) => c.id));
        if (mode === "start") {
          let start = snap(orig.start + dt, edges, threshold);
          let lo = 0;
          let hi = Number.POSITIVE_INFINITY;
          for (const c of trimmed) {
            const item = c.type === "media" ? media.get(c.mediaId) : undefined;
            const b = neighbourBounds(base, c, trimSet);
            lo = Math.max(lo, b.lo);
            if (c.type === "media" && item && item.kind !== "image") lo = Math.max(lo, c.start - c.in / c.speed);
            hi = Math.min(hi, clipEnd(c) - MIN_CLIP);
          }
          start = Math.min(Math.max(start, lo), hi);
          const shift = start - orig.start;
          gesture.live({
            ...base,
            clips: base.clips.map((c) => {
              if (!trimSet.has(c.id)) return c;
              const keyframes = Object.fromEntries(
                Object.entries(c.keyframes).map(([k, v]) => [k, v!.map((f) => ({ t: f.t - shift, v: f.v }))]),
              );
              const next = { ...c, start, duration: c.duration - shift, keyframes };
              return next.type === "media" && c.type === "media" ? { ...next, in: c.in + shift * c.speed } : next;
            }) as Clip[],
          });
        } else {
          let end = snap(clipEnd(orig) + dt, edges, threshold);
          let lo = 0;
          let hi = Number.POSITIVE_INFINITY;
          for (const c of trimmed) {
            const item = c.type === "media" ? media.get(c.mediaId) : undefined;
            lo = Math.max(lo, c.start + MIN_CLIP);
            hi = Math.min(hi, neighbourBounds(base, c, trimSet).hi, c.start + maxSourceLength(c, item));
          }
          end = Math.max(lo, Math.min(end, hi));
          gesture.live({
            ...base,
            clips: base.clips.map((c) => (trimSet.has(c.id) ? { ...c, duration: end - c.start } : c)),
          });
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        gesture.end();
        // A plain click on part of a bigger selection narrows it to that clip.
        if (!moved && mode === "move" && wasSelected && moving.size > own.size) onSelect(own, clip.id);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [gesture, media, onSelect, pps, project, selection, time, trackAtClientY],
  );

  const onClipMenu = useCallback(
    (e: React.MouseEvent, clip: Clip) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selection.has(clip.id)) onSelect(withLinked(project, [clip.id]), clip.id);
      onMenu({ kind: "clip", clipId: clip.id }, e.clientX, e.clientY);
    },
    [onMenu, onSelect, project, selection],
  );

  // ── Markers ────────────────────────────────────────────────
  const onMarkerDown = useCallback(
    (e: React.PointerEvent, markerId: string) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const base = gesture.begin();
      const m = base.markers.find((x) => x.id === markerId)!;
      const x0 = e.clientX;
      let moved = false;
      const move = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientX - x0) < DRAG_PX) return;
        moved = true;
        const t = Math.max(0, m.time + (ev.clientX - x0) / pps);
        gesture.live({ ...base, markers: base.markers.map((x) => (x.id === markerId ? { ...x, time: t } : x)) });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        gesture.end();
        if (!moved) onSeek(m.time);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [gesture, onSeek, pps],
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
        <div
          className="shrink-0 border-r-2 border-foreground bg-muted self-start min-h-full"
          style={{ width: TRACK_HEADER_W }}
        >
          <div style={{ height: RULER_H }} className="sticky top-0 z-30 border-b-2 border-foreground bg-muted" />
          {project.tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              empty={!project.clips.some((c) => c.trackId === track.id)}
              onToggle={onToggleTrack}
              onRemove={onRemoveTrack}
              onRename={onRenameTrack}
              onMenu={(x, y) => onMenu({ kind: "track", trackId: track.id }, x, y)}
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
              onPointerDown={onRulerDown}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 border-l border-foreground/30"
                  style={{ left: t * pps }}
                >
                  <span className="absolute left-1 top-1 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {fmtTime(t)}
                  </span>
                </div>
              ))}
              {project.markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-marker
                  title="Marker: click to jump, drag to move, right-click to remove"
                  aria-label={`Marker at ${fmtTime(m.time)}`}
                  className="absolute bottom-0 -translate-x-1/2 w-3 h-3.5 bg-primary border-2 border-foreground [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)] cursor-grab"
                  style={{ left: m.time * pps }}
                  onPointerDown={(e) => onMarkerDown(e, m.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onMenu({ kind: "marker", markerId: m.id }, e.clientX, e.clientY);
                  }}
                />
              ))}
            </div>

            {project.tracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                className={`relative border-b border-foreground/20 ${track.hidden || track.muted ? "opacity-50" : ""}`}
                style={{ height: ROW_H[track.kind] }}
                onPointerDown={onLaneDown}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onMenu({ kind: "lane", trackId: track.id, time: timeFromClientX(e.clientX) }, e.clientX, e.clientY);
                }}
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
                      selected={selection.has(clip.id)}
                      primary={clip.id === primaryId}
                      onDown={onClipDown}
                      onMenu={onClipMenu}
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

            {/* Markers through the lanes */}
            {project.markers.map((m) => (
              <div
                key={m.id}
                className="absolute bottom-0 w-px bg-primary/50 pointer-events-none z-10"
                style={{ left: m.time * pps, top: RULER_H }}
              />
            ))}

            {marquee && (
              <div
                className="absolute z-20 border-2 border-dashed border-foreground bg-primary/10 pointer-events-none"
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
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
  onRename,
  onMenu,
}: {
  track: Track;
  empty: boolean;
  onToggle: (id: string, key: "muted" | "hidden") => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMenu: (x: number, y: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const btn = "w-7 h-7 border-2 border-foreground flex items-center justify-center transition-colors";
  const off = "bg-foreground text-background";
  const on = "bg-card hover:bg-muted";
  return (
    <div
      className="flex items-center gap-1 px-2 border-b border-foreground/20 group"
      style={{ height: ROW_H[track.kind] }}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={track.name}
          aria-label="Track name"
          className="flex-1 min-w-0 h-6 px-1 text-xs font-bold uppercase tracking-wide border-2 border-foreground bg-background focus:outline-none"
          onBlur={(e) => {
            const name = e.currentTarget.value.trim();
            if (name && name !== track.name) onRename(track.id, name);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = track.name;
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span
          className="flex-1 truncate text-xs font-bold uppercase tracking-wide cursor-text"
          title="Double-click to rename"
          onDoubleClick={() => setEditing(true)}
        >
          {track.name}
        </span>
      )}
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
      {empty && !editing && (
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
  video: "bg-sky-200",
  image: "bg-violet-200",
  audio: "bg-emerald-200",
  text: "bg-amber-200",
  missing: "bg-muted",
};

function LinkGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="w-3 h-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1" strokeLinecap="round" />
    </svg>
  );
}

const ClipView = memo(function ClipView({
  clip,
  item,
  track,
  pps,
  selected,
  primary,
  onDown,
  onMenu,
}: {
  clip: Clip;
  item: MediaItem | undefined;
  track: Track;
  pps: number;
  selected: boolean;
  primary: boolean;
  onDown: (e: React.PointerEvent, clip: Clip, mode: "move" | "start" | "end") => void;
  onMenu: (e: React.MouseEvent, clip: Clip) => void;
}) {
  const width = Math.max(4, clip.duration * pps);
  const colorKey = clip.type === "text" ? "text" : !item ? "missing" : track.kind === "audio" ? "audio" : item.kind;
  const label = clip.type === "text" ? clip.text.split("\n")[0] || "Text" : (item?.name ?? "Missing media");
  const speed = clip.type === "media" ? clip.speed : 1;
  // The source strip runs at the clip's speed, so thumbnails line up with what plays.
  const sourceW = item && item.kind !== "image" ? (item.duration * pps) / speed : 0;
  const offset = clip.type === "media" ? (clip.in * pps) / speed : 0;
  const kfs = primary ? keyframeTimes(clip) : [];
  const transition = clip.type === "media" ? clip.transition : null;

  return (
    <div
      data-clip-id={clip.id}
      className={`absolute top-1 bottom-1 overflow-hidden border-2 cursor-grab active:cursor-grabbing ${CLIP_COLORS[colorKey]} ${
        selected ? "border-yellow-400 ring-2 ring-yellow-400 z-10" : "border-foreground"
      }`}
      style={{ left: clip.start * pps, width }}
      onPointerDown={(e) => onDown(e, clip, "move")}
      onContextMenu={(e) => onMenu(e, clip)}
    >
      {/* Content */}
      {clip.type === "media" && item && track.kind !== "audio" && item.kind === "video" && item.thumbs.length > 0 && (
        <div
          className="absolute inset-y-0 flex pointer-events-none opacity-80"
          style={{ left: -offset, width: sourceW }}
        >
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
      {transition && (
        <div
          title={transition.kind === "dip" ? "Dip to black" : "Crossfade"}
          className="absolute inset-y-0 left-0 pointer-events-none bg-foreground/25 [clip-path:polygon(0_0,100%_50%,0_100%)]"
          style={{ width: Math.max(8, Math.min(width / 2, (transition.duration / 2) * pps)) }}
        />
      )}
      <span className="absolute left-2 top-0.5 right-2 flex items-center gap-1 text-[11px] font-bold text-foreground drop-shadow-[0_0_2px_var(--background)] pointer-events-none">
        {clip.linkId && <LinkGlyph />}
        {speed !== 1 && (
          <span className="shrink-0 px-1 bg-foreground text-background font-mono text-[10px] leading-4">
            {+speed.toFixed(2)}×
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
      {kfs.map((t) => (
        <span
          key={t}
          className="absolute bottom-0.5 w-2 h-2 -ml-1 rotate-45 bg-yellow-400 border border-foreground pointer-events-none"
          style={{ left: Math.min(width - 4, Math.max(4, t * pps)) }}
        />
      ))}

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

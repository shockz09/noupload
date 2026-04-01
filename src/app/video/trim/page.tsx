"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons/ui";
import { VideoTrimIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { analyzeVideo, type VideoInfo } from "@/lib/video/compress";
import { trimVideo, trimVideoRanges, type TimeRange } from "@/lib/video/trim";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────

type TrimMode = "keep" | "remove";

interface Region {
  id: number;
  start: number;
  end: number;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

function fmtShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

let _rid = 0;
const nextId = () => ++_rid;

async function generateThumbnails(url: string, dur: number, count: number): Promise<string[]> {
  const thumbs: string[] = [];
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.src = url;

  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error("Failed to load video"));
  });

  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const th = 56;
  const tw = Math.round((v.videoWidth / v.videoHeight) * th) || 100;
  c.width = tw;
  c.height = th;

  for (let i = 0; i < count; i++) {
    v.currentTime = Math.min((i / count) * dur + dur / (count * 2), dur - 0.01);
    await new Promise<void>((r) => {
      v.onseeked = () => r();
    });
    ctx.drawImage(v, 0, 0, tw, th);
    thumbs.push(c.toDataURL("image/jpeg", 0.5));
  }

  v.src = "";
  return thumbs;
}

function sorted(regions: Region[]): Region[] {
  return [...regions].sort((a, b) => a.start - b.start);
}

function computeKeepRanges(regions: Region[], mode: TrimMode, duration: number): TimeRange[] {
  const s = sorted(regions);
  if (mode === "keep") return s.map((r) => ({ start: r.start, end: r.end }));
  const keep: TimeRange[] = [];
  let cursor = 0;
  for (const r of s) {
    if (r.start > cursor) keep.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < duration) keep.push({ start: cursor, end: duration });
  return keep;
}

// ── Component ─────────────────────────────────────────────────

export default function TrimVideoPage() {
  const { isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mode, setMode] = useState<TrimMode>("keep");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [drag, setDrag] = useState<{ rid: number; type: "start" | "end" | "move" } | null>(null);
  const [expandedRegion, setExpandedRegion] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const vidRef = useRef<HTMLVideoElement>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ rs: 0, re: 0, mt: 0 });

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const dur = videoInfo?.duration ?? 0;
  const active = useMemo(() => regions.find((r) => r.id === activeId) ?? null, [regions, activeId]);
  const isRm = mode === "remove";

  const outputDur = useMemo(() => {
    const kr = computeKeepRanges(regions, mode, dur);
    return kr.reduce((s, r) => s + (r.end - r.start), 0);
  }, [regions, mode, dur]);

  // ── File handling ─────────────────────────────────────────

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const f = files[0];
      setFile(f);
      setResult(null);
      setThumbs([]);
      clearError();

      const url = URL.createObjectURL(f);
      setVideoUrl(url);

      try {
        const info = await analyzeVideo(f);
        setVideoInfo(info);
        setTime(0);
        const id = nextId();
        setRegions([{ id, start: 0, end: info.duration }]);
        setActiveId(id);

        setThumbsLoading(true);
        const cnt = Math.min(Math.max(Math.round(info.duration / 2), 8), 30);
        try {
          setThumbs(await generateThumbnails(url, info.duration, cnt));
        } catch {
          /* optional */
        } finally {
          setThumbsLoading(false);
        }
      } catch {
        setError("Could not analyze video.");
      }
    },
    [clearError, setError],
  );

  // ── Region CRUD ───────────────────────────────────────────

  const update = useCallback((id: number, u: Partial<Pick<Region, "start" | "end">>) => {
    setRegions((p) => p.map((r) => (r.id === id ? { ...r, ...u } : r)));
  }, []);

  const clamp = useCallback(
    (rid: number, ns: number, ne: number) => {
      const others = sorted(regions.filter((r) => r.id !== rid));
      let min = 0;
      let max = dur;
      for (const o of others) {
        if (o.end <= ns) min = Math.max(min, o.end);
        if (o.start >= ne) {
          max = Math.min(max, o.start);
          break;
        }
      }
      return {
        start: Math.max(min, Math.min(ns, ne - 0.1)),
        end: Math.min(max, Math.max(ne, ns + 0.1)),
      };
    },
    [regions, dur],
  );

  const addRegion = useCallback(() => {
    if (!dur) return;
    const s = sorted(regions);
    const gaps: TimeRange[] = [];
    let c = 0;
    for (const r of s) {
      if (r.start > c + 0.5) gaps.push({ start: c, end: r.start });
      c = Math.max(c, r.end);
    }
    if (c < dur - 0.5) gaps.push({ start: c, end: dur });
    if (!gaps.length) return; // no space

    const big = gaps.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
    const mid = (big.start + big.end) / 2;
    const half = Math.min((big.end - big.start) * 0.4, dur * 0.1);
    const id = nextId();
    setRegions((p) => [...p, { id, start: mid - half, end: mid + half }]);
    setActiveId(id);
  }, [dur, regions]);

  const addRegionAt = useCallback(
    (t: number) => {
      if (!dur) return;
      // Check if click is inside an existing region — if so, select it instead
      const hit = regions.find((r) => t >= r.start && t < r.end);
      if (hit) {
        setActiveId(hit.id);
        return;
      }
      // Find the gap that contains this time
      const s = sorted(regions);
      let gapStart = 0;
      let gapEnd = dur;
      for (const r of s) {
        if (r.start > t) {
          gapEnd = r.start;
          break;
        }
        gapStart = r.end;
      }
      if (gapEnd - gapStart < 0.5) return;
      const half = Math.min((gapEnd - gapStart) * 0.3, 5);
      const ns = Math.max(gapStart, t - half);
      const ne = Math.min(gapEnd, t + half);
      const id = nextId();
      setRegions((p) => [...p, { id, start: ns, end: ne }]);
      setActiveId(id);
    },
    [dur, regions],
  );

  const removeRegion = useCallback(
    (id: number) => {
      setRegions((p) => {
        const next = p.filter((r) => r.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    [activeId],
  );

  /** Split active region at current playhead */
  const splitAtPlayhead = useCallback(() => {
    if (!active) return;
    if (time <= active.start + 0.2 || time >= active.end - 0.2) return; // too close to edge
    const newId = nextId();
    setRegions((p) =>
      p.flatMap((r) =>
        r.id === active.id
          ? [
              { ...r, end: time },
              { id: newId, start: time, end: r.end },
            ]
          : [r],
      ),
    );
    setActiveId(newId);
  }, [active, time]);

  // ── Playback ──────────────────────────────────────────────

  const seekTo = useCallback(
    (t: number) => {
      if (!vidRef.current) return;
      const c = Math.max(0, Math.min(t, dur));
      vidRef.current.currentTime = c;
      setTime(c);
    },
    [dur],
  );

  const togglePlay = useCallback(() => {
    if (!vidRef.current) return;
    if (playing) {
      vidRef.current.pause();
      setPlaying(false);
    } else {
      vidRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  // ── Keyboard ──────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!file || !videoInfo || result || isProcessing) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekTo(time - (e.shiftKey ? 5 : 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          seekTo(time + (e.shiftKey ? 5 : 1));
          break;
        case "BracketLeft":
          if (active) {
            e.preventDefault();
            update(active.id, { start: Math.min(time, active.end - 0.1) });
          }
          break;
        case "BracketRight":
          if (active) {
            e.preventDefault();
            update(active.id, { end: Math.max(time, active.start + 0.1) });
          }
          break;
        case "KeyS":
          e.preventDefault();
          splitAtPlayhead();
          break;
        case "Delete":
        case "Backspace":
          if (active && regions.length > 1) {
            e.preventDefault();
            removeRegion(active.id);
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, videoInfo, result, isProcessing, togglePlay, seekTo, time, active, regions.length, update, removeRegion, splitAtPlayhead]);

  // ── Timeline drag ─────────────────────────────────────────

  const timeFromX = useCallback(
    (clientX: number) => {
      if (!tlRef.current || dur === 0) return null;
      const rect = tlRef.current.getBoundingClientRect();
      return (Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width) * dur;
    },
    [dur],
  );

  const startDrag = useCallback(
    (rid: number, type: "start" | "end" | "move", clientX: number) => {
      const r = regions.find((r) => r.id === rid);
      if (!r) return;
      setDrag({ rid, type });
      setActiveId(rid);
      dragRef.current = { rs: r.start, re: r.end, mt: timeFromX(clientX) ?? 0 };
    },
    [regions, timeFromX],
  );

  const onHandleMouse = useCallback(
    (rid: number, type: "start" | "end" | "move") => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(rid, type, e.clientX);
    },
    [startDrag],
  );

  const onHandleTouch = useCallback(
    (rid: number, type: "start" | "end" | "move") => (e: React.TouchEvent) => {
      e.stopPropagation();
      if (e.touches[0]) startDrag(rid, type, e.touches[0].clientX);
    },
    [startDrag],
  );

  // Single click → seek, double click → add region
  const lastClickRef = useRef(0);
  const onTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (drag) return;
      const t = timeFromX(e.clientX);
      if (t === null) return;

      const now = Date.now();
      if (now - lastClickRef.current < 350) {
        // Double click
        addRegionAt(t);
      } else {
        seekTo(t);
      }
      lastClickRef.current = now;
    },
    [drag, timeFromX, seekTo, addRegionAt],
  );

  useEffect(() => {
    if (!drag) return;

    const move = (cx: number) => {
      const t = timeFromX(cx);
      if (t === null) return;
      const { rs, re, mt } = dragRef.current;

      if (drag.type === "start") {
        const c = clamp(drag.rid, t, re);
        update(drag.rid, { start: c.start });
        seekTo(c.start);
      } else if (drag.type === "end") {
        const c = clamp(drag.rid, rs, t);
        update(drag.rid, { end: c.end });
        seekTo(c.end);
      } else {
        const delta = t - mt;
        const len = re - rs;
        const c = clamp(drag.rid, rs + delta, rs + delta + len);
        if (c.end - c.start >= len - 0.01) {
          update(drag.rid, { start: c.start, end: c.start + len });
        }
      }
    };

    const onMM = (e: MouseEvent) => move(e.clientX);
    const onTM = (e: TouchEvent) => e.touches[0] && move(e.touches[0].clientX);
    const end = () => setDrag(null);

    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", onTM, { passive: true });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", onTM);
      window.removeEventListener("touchend", end);
    };
  }, [drag, dur, clamp, update, seekTo, timeFromX]);

  // ── Processing ────────────────────────────────────────────

  const process = useCallback(async () => {
    if (!file || !videoInfo) return;
    if (!startProcessing()) return;
    setResult(null);
    try {
      const kr = computeKeepRanges(regions, mode, dur);
      const r =
        kr.length === 1
          ? await trimVideo(file, kr[0], (p: number) => setProgress(p * 100))
          : await trimVideoRanges(file, kr, (p: number) => setProgress(p * 100));
      setResult(r);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to trim video"));
    } finally {
      stopProcessing();
    }
  }, [file, videoInfo, regions, mode, dur, startProcessing, setProgress, setError, stopProcessing]);

  const download = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (result) downloadBlob(result.blob, result.filename, "video/mp4");
    },
    [result],
  );

  const reset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(null);
    setVideoInfo(null);
    setVideoUrl(null);
    setThumbs([]);
    setRegions([]);
    setActiveId(null);
    setResult(null);
    setPlaying(false);
    setTime(0);
    setExpandedRegion(null);
    clearError();
  }, [videoUrl, clearError]);

  const { add: addToBuffer } = useFileBuffer();
  const holdInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "video/mp4",
      size: result.blob.size,
      fileType: "other",
      sourceToolLabel: "Trim Video",
    });
  }, [result, addToBuffer]);

  // ── Derived styles ────────────────────────────────────────

  const pct = (t: number) => (dur > 0 ? (t / dur) * 100 : 0);
  const hc = isRm ? "bg-red-500" : "bg-primary";
  const hch = isRm ? "hover:bg-red-500/80" : "hover:bg-primary/80";
  const bc = isRm ? "border-red-500" : "border-primary";
  const tc = isRm ? "text-red-500" : "text-primary";

  if (!isLoaded) return null;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="page-enter max-w-3xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoTrimIcon className="w-7 h-7" />}
        iconClass="tool-video-trim"
        title="Trim Video"
        description="Keep or remove sections of your video"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title={isRm ? "Sections Removed!" : "Video Trimmed!"}
          subtitle={fmtShort(outputDur)}
          downloadLabel="Download Video"
          onDownload={download}
          onHoldInBuffer={holdInBuffer}
          onStartOver={reset}
          startOverLabel="Trim Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFiles}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox>Visually select sections to keep or cut out — supports multiple selections.</InfoBox>
        </div>
      ) : (
        <div className="space-y-5">
          <VideoFileInfo
            file={file}
            duration={videoInfo?.duration}
            resolution={videoInfo ? `${videoInfo.width}×${videoInfo.height}` : undefined}
            onClear={reset}
            icon={<VideoToolIcon className="w-5 h-5" />}
          />

          {/* Mode toggle */}
          <div className="flex border-2 border-foreground">
            <button
              type="button"
              onClick={() => setMode("keep")}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                mode === "keep" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              Keep Selection{regions.length > 1 ? "s" : ""}
            </button>
            <button
              type="button"
              onClick={() => setMode("remove")}
              className={`flex-1 py-2.5 text-sm font-bold border-l-2 border-foreground transition-colors ${
                isRm ? "bg-destructive text-white" : "hover:bg-muted"
              }`}
            >
              Remove Selection{regions.length > 1 ? "s" : ""}
            </button>
          </div>

          {/* Video player */}
          {videoUrl && (
            <div className="border-2 border-foreground bg-black relative group">
              <video
                ref={vidRef}
                src={videoUrl}
                className="w-full max-h-[360px] object-contain"
                onTimeUpdate={() => vidRef.current && setTime(vidRef.current.currentTime)}
                onEnded={() => setPlaying(false)}
                preload="auto"
                playsInline
                onClick={togglePlay}
              />
              {!playing && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    <PlayIcon className="w-7 h-7 text-black ml-1" />
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Timeline + controls */}
          {videoInfo && !isProcessing && (
            <div className="space-y-3">
              {/* Timeline */}
              <div
                ref={tlRef}
                className={`relative h-16 border-2 border-foreground select-none overflow-hidden ${
                  drag ? "cursor-grabbing" : "cursor-pointer"
                }`}
                onClick={onTimelineClick}
              >
                {/* Thumbnails */}
                {thumbs.length > 0 ? (
                  <div className="absolute inset-0 flex">
                    {thumbs.map((t, i) => (
                      <img key={i} src={t} alt="" className="h-full flex-1 object-cover" draggable={false} />
                    ))}
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-muted/50">
                    {thumbsLoading && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        Loading preview...
                      </div>
                    )}
                  </div>
                )}

                {/* Dim overlays */}
                {isRm
                  ? sorted(regions).map((r) => (
                      <div
                        key={`d-${r.id}`}
                        className="absolute top-0 bottom-0 bg-red-500/30 pointer-events-none"
                        style={{ left: `${pct(r.start)}%`, width: `${pct(r.end - r.start)}%` }}
                      />
                    ))
                  : (() => {
                      const s = sorted(regions);
                      const dims: { l: number; w: number }[] = [];
                      let c = 0;
                      for (const r of s) {
                        if (r.start > c) dims.push({ l: pct(c), w: pct(r.start - c) });
                        c = Math.max(c, r.end);
                      }
                      if (c < dur) dims.push({ l: pct(c), w: pct(dur - c) });
                      return dims.map((d, i) => (
                        <div
                          key={`d-${i}`}
                          className="absolute top-0 bottom-0 bg-black/60 pointer-events-none"
                          style={{ left: `${d.l}%`, width: `${d.w}%` }}
                        />
                      ));
                    })()}

                {/* Regions: borders, handles, labels */}
                {regions.map((r) => {
                  const l = pct(r.start);
                  const w = pct(r.end - r.start);
                  const isAct = r.id === activeId;
                  const idx = sorted(regions).findIndex((x) => x.id === r.id) + 1;

                  return (
                    <div key={r.id}>
                      {/* Border */}
                      <div
                        className={`absolute top-0 bottom-0 border-y-2 pointer-events-none ${bc} ${
                          isAct ? "z-[5]" : "z-[3] opacity-60"
                        }`}
                        style={{ left: `${l}%`, width: `${w}%` }}
                      />

                      {/* Move body */}
                      <div
                        className={`absolute top-0 bottom-0 cursor-grab ${
                          drag?.rid === r.id && drag.type === "move" ? "cursor-grabbing" : ""
                        } ${isAct ? "z-[4]" : "z-[2]"}`}
                        style={{ left: `${l}%`, width: `${w}%` }}
                        onMouseDown={onHandleMouse(r.id, "move")}
                        onTouchStart={onHandleTouch(r.id, "move")}
                      />

                      {/* Region number label */}
                      {regions.length > 1 && w > 3 && (
                        <div
                          className={`absolute top-0.5 pointer-events-none z-[6] text-[9px] font-bold leading-none px-1 py-0.5 ${
                            isAct
                              ? isRm
                                ? "bg-red-500 text-white"
                                : "bg-primary text-primary-foreground"
                              : "bg-foreground/40 text-white"
                          }`}
                          style={{ left: `calc(${l}% + 4px)` }}
                        >
                          {idx}
                        </div>
                      )}

                      {/* Start handle */}
                      <div
                        className={`absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-10 ${hc} ${hch} ${
                          isAct ? "" : "opacity-60"
                        }`}
                        style={{ left: `calc(${l}% - 6px)` }}
                        onMouseDown={onHandleMouse(r.id, "start")}
                        onTouchStart={onHandleTouch(r.id, "start")}
                      >
                        <div className="w-0.5 h-8 bg-primary-foreground/60" />
                      </div>

                      {/* End handle */}
                      <div
                        className={`absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-10 ${hc} ${hch} ${
                          isAct ? "" : "opacity-60"
                        }`}
                        style={{ left: `calc(${l + w}% - 6px)` }}
                        onMouseDown={onHandleMouse(r.id, "end")}
                        onTouchStart={onHandleTouch(r.id, "end")}
                      >
                        <div className="w-0.5 h-8 bg-primary-foreground/60" />
                      </div>
                    </div>
                  );
                })}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
                  style={{ left: `${pct(time)}%` }}
                >
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rotate-45" />
                </div>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-10 h-10 border-2 border-foreground flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                  title="Play/Pause (Space)"
                >
                  {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
                </button>

                {/* Current time */}
                <span className="font-mono text-sm font-bold tabular-nums w-20">{fmt(time)}</span>

                {/* Split button */}
                {active && time > active.start + 0.2 && time < active.end - 0.2 && (
                  <button
                    type="button"
                    onClick={splitAtPlayhead}
                    className="px-3 py-1.5 border-2 border-foreground text-xs font-bold hover:bg-muted transition-colors shrink-0"
                    title="Split region at playhead (S)"
                  >
                    Split
                  </button>
                )}

                <div className="flex-1 text-right">
                  <span className="text-sm text-muted-foreground">{isRm ? "After cut: " : "Output: "}</span>
                  <span className="text-sm font-bold font-mono">{fmt(outputDur)}</span>
                  <span className="text-sm text-muted-foreground"> / {fmtShort(dur)}</span>
                </div>
              </div>

              {/* Region list */}
              <div className="space-y-1.5">
                {sorted(regions).map((r, i) => {
                  const isExp = expandedRegion === r.id;
                  return (
                    <div key={r.id}>
                      <div
                        className={`flex items-center gap-2 px-3 py-2 border-2 cursor-pointer transition-colors ${
                          r.id === activeId ? `${bc} bg-muted/40` : "border-foreground/20 hover:border-foreground/40"
                        }`}
                        onClick={() => {
                          setActiveId(r.id);
                          seekTo(r.start);
                        }}
                      >
                        {/* Number badge */}
                        <span
                          className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0 ${
                            r.id === activeId
                              ? isRm
                                ? "bg-red-500 text-white"
                                : "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </span>

                        {/* Time range */}
                        <span className="font-mono text-sm font-bold flex-1">
                          {fmt(r.start)}
                          <span className="text-muted-foreground mx-1.5">→</span>
                          {fmt(r.end)}
                        </span>

                        {/* Duration */}
                        <span className="text-xs font-mono text-muted-foreground">{fmtShort(r.end - r.start)}</span>

                        {/* Expand / collapse for fine-tune */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRegion(isExp ? null : r.id);
                          }}
                          className="text-muted-foreground hover:text-foreground text-xs px-1"
                          title="Fine-tune"
                        >
                          {isExp ? "▲" : "▼"}
                        </button>

                        {/* Delete */}
                        {regions.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRegion(r.id);
                            }}
                            className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
                            title="Delete (Del)"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Expanded: fine-tune inputs + set-to-current buttons */}
                      {isExp && (
                        <div className="flex gap-2 px-3 py-2 border-x-2 border-b-2 border-foreground/20 bg-muted/20">
                          <div className="flex-1 space-y-0.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Start (s)</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={0}
                                max={r.end - 0.1}
                                step={0.1}
                                value={Math.round(r.start * 10) / 10}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (!isNaN(v)) {
                                    const c = clamp(r.id, v, r.end);
                                    update(r.id, { start: c.start });
                                  }
                                }}
                                className="flex-1 h-7 px-2 border border-foreground/30 font-mono text-xs bg-background"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const c = clamp(r.id, time, r.end);
                                  update(r.id, { start: c.start });
                                }}
                                className="h-7 px-2 border border-foreground/30 text-[10px] font-bold hover:bg-muted"
                                title="Set start to current time ( [ )"
                              >
                                [
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">End (s)</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={r.start + 0.1}
                                max={Math.round(dur * 10) / 10}
                                step={0.1}
                                value={Math.round(r.end * 10) / 10}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (!isNaN(v)) {
                                    const c = clamp(r.id, r.start, v);
                                    update(r.id, { end: c.end });
                                  }
                                }}
                                className="flex-1 h-7 px-2 border border-foreground/30 font-mono text-xs bg-background"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const c = clamp(r.id, r.start, time);
                                  update(r.id, { end: c.end });
                                }}
                                className="h-7 px-2 border border-foreground/30 text-[10px] font-bold hover:bg-muted"
                                title="Set end to current time ( ] )"
                              >
                                ]
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addRegion}
                  className="w-full py-2 border-2 border-dashed border-foreground/30 hover:border-foreground/60 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                  title="Or double-click timeline"
                >
                  + Add Selection
                </button>
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          <button type="button" onClick={process} disabled={isProcessing || !videoInfo} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isRm ? "Cutting" : "Trimming"}... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoTrimIcon className="w-5 h-5" />
                {isRm ? "Remove" : "Keep"} {regions.length > 1 ? `${regions.length} Selections` : "Selection"}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

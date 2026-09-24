import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/editor")({
  head: () => ({
    meta: [
      { title: "Free Online Video Editor - Multi-Track, No Upload | noupload" },
      {
        name: "description",
        content:
          "Edit video in your browser: multi-track timeline, audio tracks, text, images, trim, split, fades and MP4 export. Nothing is uploaded.",
      },
      {
        name: "keywords",
        content: "video editor, online video editor, free video editor, multi track video editor, add text to video, no upload",
      },
      { property: "og:title", content: "Free Online Video Editor - Multi-Track, No Upload" },
      { property: "og:description", content: "Multi-track video editing in your browser. Works 100% offline." },
    ],
  }),
  component: VideoEditorPage,
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtTime, type Gesture, Timeline } from "@/components/video-editor/Timeline";
import { PauseIcon, PlayIcon, TrashIcon } from "@/components/icons/ui";
import { VideoEditorIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, ProgressBar, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useFileBuffer } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { exportProject } from "@/lib/video/editor/export";
import { forgetMedia, importMedia, loadVideoPeaks, mediaKindOf } from "@/lib/video/editor/media";
import {
  type Clip,
  type MediaClip,
  type MediaItem,
  type Project,
  type TextClip,
  type Track,
  IMAGE_DEFAULT_DURATION,
  TEXT_DEFAULT_DURATION,
  clipAt,
  clipEnd,
  createProject,
  findFreeStart,
  projectDuration,
  removeClips,
  splitClip,
  trackKindFor,
  uid,
  updateClip,
} from "@/lib/video/editor/model";
import { PreviewEngine } from "@/lib/video/editor/preview";
import { AUDIO_EXTENSIONS, MEDIABUNNY_VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

const IMAGE_EXTENSIONS = ".png,.jpg,.jpeg,.webp,.gif,.avif,.bmp";
const ACCEPT = `${MEDIABUNNY_VIDEO_EXTENSIONS},${AUDIO_EXTENSIONS},${IMAGE_EXTENSIONS}`;
const HISTORY_LIMIT = 100;

const RESOLUTIONS = [
  { label: "1080p landscape (1920×1080)", w: 1920, h: 1080 },
  { label: "720p landscape (1280×720)", w: 1280, h: 720 },
  { label: "4K landscape (3840×2160)", w: 3840, h: 2160 },
  { label: "Vertical 1080×1920", w: 1080, h: 1920 },
  { label: "Square 1080×1080", w: 1080, h: 1080 },
  { label: "Portrait 4:5 (1080×1350)", w: 1080, h: 1350 },
];

interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2);
}

function VideoEditorPage() {
  const [hist, setHist] = useState<History>(() => ({ past: [], present: createProject(), future: [] }));
  const project = hist.present;
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const media = useMemo(() => new Map(mediaList.map((m) => [m.id, m])), [mediaList]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pps, setPps] = useState(40);
  const [importing, setImporting] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const exportAbort = useRef<AbortController | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const timeRef = useRef(time);
  timeRef.current = time;

  const duration = projectDuration(project);
  const selected = project.clips.find((c) => c.id === selectedId) ?? null;

  // ── History ────────────────────────────────────────────────
  const commit = useCallback((fn: (p: Project) => Project) => {
    setHist((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      return { past: [...h.past.slice(-HISTORY_LIMIT), h.present], present: next, future: [] };
    });
  }, []);

  const gestureBase = useRef<Project | null>(null);
  const gesture: Gesture = useMemo(
    () => ({
      begin: () => {
        gestureBase.current = projectRef.current;
        return projectRef.current;
      },
      live: (p) => setHist((h) => ({ ...h, present: p })),
      end: () => {
        const base = gestureBase.current;
        gestureBase.current = null;
        setHist((h) =>
          !base || h.present === base
            ? h
            : { past: [...h.past.slice(-HISTORY_LIMIT), base], present: h.present, future: [] },
        );
      },
    }),
    [],
  );

  const undo = useCallback(() => {
    setHist((h) =>
      h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h,
    );
  }, []);
  const redo = useCallback(() => {
    setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);

  // ── Preview engine ─────────────────────────────────────────
  const hasMedia = mediaList.length > 0 || project.clips.length > 0;
  // The engine lives as long as the editor view; project/media updates flow in through the effect below.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasMedia || result) return;
    const engine = new PreviewEngine(canvas);
    engine.onTime = setTime;
    engine.onPlayingChange = setPlaying;
    engine.setProject(projectRef.current, media);
    engine.seek(timeRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
      setPlaying(false);
    };
  }, [hasMedia, result]);

  useEffect(() => {
    engineRef.current?.setProject(project, media);
  }, [project, media]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && !project.clips.some((c) => c.id === selectedId)) setSelectedId(null);
  }, [project, selectedId]);

  const seek = useCallback((t: number) => engineRef.current?.seek(t), []);
  const togglePlay = useCallback(() => engineRef.current?.toggle(), []);

  // ── Import ─────────────────────────────────────────────────
  const sizedFromMedia = useRef(false);
  const addFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const usable = files.filter((f) => mediaKindOf(f));
      if (usable.length < files.length) setError("Some files were skipped: only video, audio and image files work here.");
      setImporting((n) => n + usable.length);
      for (const file of usable) {
        try {
          const item = await importMedia(file);
          setMediaList((list) => [...list, item]);
          // First video sets the frame size, while nothing is on the timeline yet.
          if (item.kind === "video" && item.width && item.height && !sizedFromMedia.current) {
            sizedFromMedia.current = true;
            setHist((h) => {
              if (h.present.clips.length > 0 || h.past.length > 0) return h;
              const scale = Math.min(1, 3840 / Math.max(item.width, item.height));
              return { ...h, present: { ...h.present, width: even(item.width * scale), height: even(item.height * scale) } };
            });
          }
          if (item.kind === "video" && item.hasAudio) {
            loadVideoPeaks(item).then((peaks) => {
              setMediaList((list) => list.map((m) => (m.id === item.id ? { ...m, peaks } : m)));
            });
          }
        } catch (err) {
          setError(getErrorMessage(err, `Could not import "${file.name}".`));
        } finally {
          setImporting((n) => n - 1);
        }
      }
    },
    [],
  );

  // ── Clip creation ──────────────────────────────────────────
  const newMediaClip = useCallback(
    (id: string, item: MediaItem, trackId: string, start: number, p: Project): MediaClip => {
      const dur = item.kind === "image" ? IMAGE_DEFAULT_DURATION : item.duration;
      return {
        id,
        type: "media",
        mediaId: item.id,
        trackId,
        start: findFreeStart(p, trackId, start, dur),
        duration: dur,
        in: 0,
        x: 0.5,
        y: 0.5,
        scale: 1,
        opacity: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
      };
    },
    [],
  );

  /** Add media at `t` on `trackId`, or the bottom-most compatible track at the playhead. */
  const addMediaToTimeline = useCallback(
    (mediaId: string, trackId?: string, t?: number) => {
      const item = media.get(mediaId);
      if (!item) return;
      const id = uid("c");
      commit((p) => {
        const want = trackKindFor(item.kind);
        let track = trackId ? p.tracks.find((tr) => tr.id === trackId) : undefined;
        // Video dropped on an audio track brings just its sound.
        const ok = track && (track.kind === want || (track.kind === "audio" && item.kind === "video" && item.hasAudio));
        // Default to "Video 1" (bottom of the video stack) or "Audio 1" (top of the audio stack).
        if (!ok) track = want === "video" ? p.tracks.findLast((tr) => tr.kind === "video") : p.tracks.find((tr) => tr.kind === want);
        if (!track) return p;
        return { ...p, clips: [...p.clips, newMediaClip(id, item, track.id, t ?? timeRef.current, p)] };
      });
      setSelectedId(id);
    },
    [commit, media, newMediaClip],
  );

  const addText = useCallback(() => {
    const id = uid("c");
    commit((p) => {
      let tracks = p.tracks;
      let track = tracks.find((t) => t.kind === "text");
      if (!track) {
        track = { id: uid("t"), kind: "text", name: "Text", muted: false, hidden: false };
        tracks = [track, ...tracks];
      }
      const next = { ...p, tracks };
      const clip: TextClip = {
        id,
        type: "text",
        trackId: track.id,
        start: findFreeStart(next, track.id, timeRef.current, TEXT_DEFAULT_DURATION),
        duration: TEXT_DEFAULT_DURATION,
        text: "Your text",
        size: 96,
        color: "#ffffff",
        background: null,
        bold: true,
        x: 0.5,
        y: 0.5,
        opacity: 1,
      };
      return { ...next, clips: [...next.clips, clip] };
    });
    setSelectedId(id);
  }, [commit]);

  const addTrack = useCallback(
    (kind: Track["kind"]) => {
      commit((p) => {
        const count = p.tracks.filter((t) => t.kind === kind).length + 1;
        const name = kind === "video" ? `Video ${count}` : kind === "audio" ? `Audio ${count}` : `Text ${count}`;
        const track: Track = { id: uid("t"), kind, name, muted: false, hidden: false };
        const tracks = [...p.tracks];
        // New video/text tracks go on top of their group; audio tracks at the bottom.
        const idx = kind === "audio" ? tracks.length : Math.max(0, tracks.findIndex((t) => t.kind === kind));
        tracks.splice(idx, 0, track);
        return { ...p, tracks };
      });
    },
    [commit],
  );

  // ── Clip operations ────────────────────────────────────────
  const splitAtPlayhead = useCallback(() => {
    const t = timeRef.current;
    commit((p) => {
      if (selectedId) {
        const c = p.clips.find((x) => x.id === selectedId);
        if (c && t > c.start && t < clipEnd(c)) return splitClip(p, c.id, t);
      }
      // Nothing selected under the playhead: cut every clip it crosses.
      let next = p;
      for (const track of p.tracks) {
        const c = clipAt(p, track.id, t);
        if (c) next = splitClip(next, c.id, t);
      }
      return next;
    });
  }, [commit, selectedId]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit((p) => removeClips(p, new Set([selectedId])));
    setSelectedId(null);
  }, [commit, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const id = uid("c");
    commit((p) => {
      const start = findFreeStart(p, selected.trackId, clipEnd(selected), selected.duration);
      return { ...p, clips: [...p.clips, { ...selected, id, start } as Clip] };
    });
    setSelectedId(id);
  }, [commit, selected]);

  const patchSelected = useCallback(
    (patch: Partial<MediaClip> | Partial<TextClip>) => {
      if (selectedId) commit((p) => updateClip(p, selectedId, patch));
    },
    [commit, selectedId],
  );

  /** Continuous edits (sliders) record one history step per interaction. */
  const livePatch = useCallback(
    (patch: Partial<MediaClip> | Partial<TextClip>) => {
      if (!selectedId) return;
      if (!gestureBase.current) gesture.begin();
      gesture.live(updateClip(projectRef.current, selectedId, patch));
    },
    [gesture, selectedId],
  );

  const detachAudio = useCallback(() => {
    if (!selected || selected.type !== "media") return;
    const clip = selected;
    commit((p) => {
      let tracks = p.tracks;
      let target = tracks.find(
        (t) => t.kind === "audio" && findFreeStart(p, t.id, clip.start, clip.duration) === clip.start,
      );
      if (!target) {
        target = { id: uid("t"), kind: "audio", name: `Audio ${tracks.filter((t) => t.kind === "audio").length + 1}`, muted: false, hidden: false };
        tracks = [...tracks, target];
      }
      const audio: MediaClip = { ...clip, id: uid("c"), trackId: target.id, x: 0.5, y: 0.5, scale: 1, opacity: 1 };
      return { ...p, tracks, clips: [...p.clips.map((c) => (c.id === clip.id ? { ...clip, volume: 0 } : c)), audio] };
    });
  }, [commit, selected]);

  const removeMedia = useCallback(
    (item: MediaItem) => {
      commit((p) => ({ ...p, clips: p.clips.filter((c) => c.type !== "media" || c.mediaId !== item.id) }));
      setMediaList((list) => list.filter((m) => m.id !== item.id));
      forgetMedia(item);
    },
    [commit],
  );

  const toggleTrack = useCallback(
    (trackId: string, key: "muted" | "hidden") =>
      commit((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, [key]: !t[key] } : t)) })),
    [commit],
  );
  const removeTrack = useCallback(
    (trackId: string) => commit((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== trackId) })),
    [commit],
  );

  // ── Preview canvas: click to select, drag to reposition ────
  const onCanvasDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const engine = engineRef.current;
      if (!engine || e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const p = projectRef.current;
      const toFrame = (cx: number, cy: number) => ({
        x: ((cx - rect.left) / rect.width) * p.width,
        y: ((cy - rect.top) / rect.height) * p.height,
      });
      const pt = toFrame(e.clientX, e.clientY);
      const hit = engine.hitTest(pt.x, pt.y);
      setSelectedId(hit);
      if (!hit) return;
      const base = gesture.begin();
      const clip = base.clips.find((c) => c.id === hit)!;
      const move = (ev: PointerEvent) => {
        const q = toFrame(ev.clientX, ev.clientY);
        const x = Math.min(1.5, Math.max(-0.5, clip.x + (q.x - pt.x) / p.width));
        const y = Math.min(1.5, Math.max(-0.5, clip.y + (q.y - pt.y) / p.height));
        gesture.live(updateClip(base, hit, { x, y }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        gesture.end();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [gesture],
  );

  // ── Export ─────────────────────────────────────────────────
  const runExport = useCallback(async () => {
    engineRef.current?.pause();
    setError(null);
    setExportProgress(0);
    const abort = new AbortController();
    exportAbort.current = abort;
    try {
      const blob = await exportProject(projectRef.current, media, {
        onProgress: (p) => setExportProgress(p),
        signal: abort.signal,
      });
      setResult(blob);
    } catch (err) {
      if (!abort.signal.aborted) setError(getErrorMessage(err, "Export failed."));
    } finally {
      exportAbort.current = null;
      setExportProgress(null);
    }
  }, [media]);

  const download = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (result) downloadBlob(result, "edited-video.mp4", "video/mp4");
    },
    [result],
  );

  const { add: addToBuffer } = useFileBuffer();
  const holdInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: "edited-video.mp4",
      blob: result,
      mimeType: "video/mp4",
      size: result.size,
      fileType: "video",
      sourceToolLabel: "Video Editor",
    });
  }, [result, addToBuffer]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    if (!hasMedia || result) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const fps = projectRef.current.fps;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (!mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        splitAtPlayhead();
      } else if (!mod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        addText();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / fps;
        seek(timeRef.current + (e.key === "ArrowLeft" ? -step : step));
      } else if (e.key === "Home") {
        e.preventDefault();
        seek(0);
      } else if (e.key === "End") {
        e.preventDefault();
        seek(projectDuration(projectRef.current));
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasMedia, result, togglePlay, undo, redo, duplicateSelected, splitAtPlayhead, addText, deleteSelected, seek]);

  // Drop files anywhere on the editor.
  const onEditorDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles],
  );

  const exporting = exportProgress !== null;

  return (
    <div className="page-enter space-y-6">
      <VideoPageHeader
        icon={<VideoEditorIcon className="w-7 h-7" />}
        iconClass="tool-video-editor"
        title="Video Editor"
        description="Multi-track editing with audio, text and images — all in your browser"
      />

      {result ? (
        <div className="max-w-3xl mx-auto">
          <VideoResultView
            blob={result}
            title="Video Exported!"
            subtitle={`${project.width}×${project.height} · ${fmtTime(duration)}`}
            downloadLabel="Download Video"
            onDownload={download}
            onHoldInBuffer={holdInBuffer}
            onStartOver={() => setResult(null)}
            startOverLabel="Back to Editor"
          />
        </div>
      ) : !hasMedia ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <FileDropzone
            accept={ACCEPT}
            multiple
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={addFiles}
            title="Drop videos, audio and images"
            subtitle="MP4, MOV, WebM, MKV · MP3, WAV, M4A · PNG, JPG"
          />
          {importing > 0 && <ProgressBar progress={50} label="Importing media..." />}
          {error && <ErrorBox message={error} />}
          <InfoBox>
            Arrange clips on video, audio and text tracks, trim and split them, then export an MP4. Your files never leave
            this device.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-4" onDragOver={(e) => e.preventDefault()} onDrop={onEditorDrop}>
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
            {/* Media bin */}
            <div className="border-2 border-foreground bg-card flex flex-col min-h-0 lg:max-h-[520px]">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-foreground">
                <span className="text-sm font-bold">Media</span>
                <button
                  type="button"
                  className="text-xs font-bold border-2 border-foreground px-2 py-0.5 hover:bg-muted"
                  onClick={() => fileInputRef.current?.click()}
                >
                  + Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {mediaList.map((item) => (
                  <MediaCard key={item.id} item={item} onAdd={addMediaToTimeline} onRemove={removeMedia} />
                ))}
                {importing > 0 && (
                  <div className="text-xs text-muted-foreground text-center py-2">Importing {importing}…</div>
                )}
                <p className="text-[11px] text-muted-foreground px-1">Drag onto a track, or press + to add at the playhead.</p>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2 min-w-0">
              <div className="border-2 border-foreground bg-black flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  onPointerDown={onCanvasDown}
                  className="max-w-full max-h-[440px] w-auto h-auto block"
                  style={{ aspectRatio: `${project.width} / ${project.height}` }}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={togglePlay}
                  title="Play/Pause (Space)"
                  className="w-10 h-10 border-2 border-foreground flex items-center justify-center hover:bg-muted"
                >
                  {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
                </button>
                <span className="font-mono text-sm tabular-nums">
                  {fmtTime(time, project.fps)} / {fmtTime(duration, project.fps)}
                </span>
                <div className="flex-1" />
                <ToolButton onClick={undo} disabled={!hist.past.length} title="Undo (⌘Z)">
                  Undo
                </ToolButton>
                <ToolButton onClick={redo} disabled={!hist.future.length} title="Redo (⇧⌘Z)">
                  Redo
                </ToolButton>
              </div>
            </div>

            {/* Inspector */}
            <div className="border-2 border-foreground bg-card lg:max-h-[520px] overflow-y-auto">
              <div className="px-3 py-2 border-b-2 border-foreground text-sm font-bold">
                {selected ? (selected.type === "text" ? "Text" : "Clip") : "Project"}
              </div>
              <div className="p-3 space-y-4">
                {selected?.type === "media" ? (
                  <MediaInspector
                    clip={selected}
                    item={media.get(selected.mediaId)}
                    onTrackKind={project.tracks.find((t) => t.id === selected.trackId)?.kind ?? "video"}
                    onLive={livePatch}
                    onCommit={gesture.end}
                    onPatch={patchSelected}
                    onDetach={detachAudio}
                  />
                ) : selected?.type === "text" ? (
                  <TextInspector clip={selected} onLive={livePatch} onCommit={gesture.end} onPatch={patchSelected} />
                ) : (
                  <ProjectInspector project={project} onChange={(patch) => commit((p) => ({ ...p, ...patch }))} />
                )}
                {selected && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-foreground/20">
                    <ToolButton onClick={splitAtPlayhead} title="Split at playhead (S)">
                      Split
                    </ToolButton>
                    <ToolButton onClick={duplicateSelected} title="Duplicate (⌘D)">
                      Copy
                    </ToolButton>
                    <ToolButton onClick={deleteSelected} title="Delete (⌫)" danger>
                      Delete
                    </ToolButton>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <ToolButton onClick={splitAtPlayhead} title="Split at playhead (S)">
              ✂ Split
            </ToolButton>
            <ToolButton onClick={addText} title="Add text (T)">
              + Text
            </ToolButton>
            <ToolButton onClick={() => addTrack("video")}>+ Video track</ToolButton>
            <ToolButton onClick={() => addTrack("audio")}>+ Audio track</ToolButton>
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-xs font-bold">
              Zoom
              <input
                type="range"
                min={4}
                max={400}
                step={1}
                value={pps}
                onChange={(e) => setPps(Number(e.target.value))}
                className="w-32"
              />
            </label>
          </div>

          <Timeline
            project={project}
            media={media}
            time={time}
            playing={playing}
            pps={pps}
            selectedId={selectedId}
            gesture={gesture}
            onSeek={seek}
            onSelect={setSelectedId}
            onToggleTrack={toggleTrack}
            onRemoveTrack={removeTrack}
            onDropMedia={addMediaToTimeline}
            onZoom={setPps}
          />
          <p className="text-[11px] text-muted-foreground">
            Space play · S split · T text · ⌫ delete · ⌘D duplicate · ⌘Z undo · ←/→ frame step · ⌘+scroll zoom · drag
            clips in the preview to move them
          </p>

          {error && <ErrorBox message={error} />}

          {exporting ? (
            <div className="space-y-3">
              <ProgressBar progress={Math.round((exportProgress ?? 0) * 100)} label={`Exporting… ${Math.round((exportProgress ?? 0) * 100)}%`} />
              <button type="button" className="btn-secondary w-full" onClick={() => exportAbort.current?.abort()}>
                Cancel export
              </button>
            </div>
          ) : (
            <button type="button" className="btn-primary w-full" disabled={duration <= 0} onClick={runExport}>
              Export MP4 ({project.width}×{project.height}, {fmtTime(duration)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────

function ToolButton({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs font-bold border-2 border-foreground px-3 py-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        danger ? "hover:bg-destructive hover:text-white" : "hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function MediaCard({
  item,
  onAdd,
  onRemove,
}: {
  item: MediaItem;
  onAdd: (id: string) => void;
  onRemove: (item: MediaItem) => void;
}) {
  const thumb = item.kind === "video" ? item.thumbs.find(Boolean) : item.kind === "image" ? item.url : null;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-editor-media", item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex items-center gap-2 border-2 border-foreground p-1.5 bg-background cursor-grab active:cursor-grabbing"
    >
      <div className="w-14 h-9 shrink-0 bg-muted flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground">AUDIO</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold truncate" title={item.name}>
          {item.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {item.kind === "image" ? "Image" : fmtTime(item.duration)}
          {item.kind === "video" && !item.hasAudio ? " · no audio" : ""}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          title="Add at playhead"
          onClick={() => onAdd(item.id)}
          className="w-6 h-6 text-sm font-bold border border-foreground/40 hover:bg-muted"
        >
          +
        </button>
        <button
          type="button"
          title="Remove from project"
          onClick={() => onRemove(item)}
          className="w-6 h-6 flex items-center justify-center border border-foreground/40 hover:bg-destructive hover:text-white opacity-0 group-hover:opacity-100"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onLive,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onLive: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-xs font-bold">
        {label}
        <span className="font-mono text-muted-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onLive(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="w-full"
      />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toFixed(1)}s`;

type TransformPatch = { x?: number; y?: number; opacity?: number; scale?: number };

function TransformControls({
  clip,
  onLive,
  onCommit,
  onPatch,
  withScale,
}: {
  clip: MediaClip | TextClip;
  onLive: (p: TransformPatch) => void;
  onCommit: () => void;
  onPatch: (p: TransformPatch) => void;
  withScale: boolean;
}) {
  return (
    <>
      <Slider label="Opacity" value={clip.opacity} min={0} max={1} step={0.01} format={pct} onLive={(v) => onLive({ opacity: v })} onCommit={onCommit} />
      {withScale && clip.type === "media" && (
        <Slider label="Scale" value={clip.scale} min={0.1} max={3} step={0.01} format={pct} onLive={(v) => onLive({ scale: v })} onCommit={onCommit} />
      )}
      <Slider label="Position X" value={clip.x} min={-0.5} max={1.5} step={0.005} format={pct} onLive={(v) => onLive({ x: v })} onCommit={onCommit} />
      <Slider label="Position Y" value={clip.y} min={-0.5} max={1.5} step={0.005} format={pct} onLive={(v) => onLive({ y: v })} onCommit={onCommit} />
      <button
        type="button"
        className="text-xs font-bold underline text-muted-foreground hover:text-foreground"
        onClick={() => onPatch(withScale ? { x: 0.5, y: 0.5, scale: 1 } : { x: 0.5, y: 0.5 })}
      >
        Reset position
      </button>
    </>
  );
}

function MediaInspector({
  clip,
  item,
  onTrackKind,
  onLive,
  onCommit,
  onPatch,
  onDetach,
}: {
  clip: MediaClip;
  item: MediaItem | undefined;
  onTrackKind: Track["kind"];
  onLive: (p: Partial<MediaClip>) => void;
  onCommit: () => void;
  onPatch: (p: Partial<MediaClip>) => void;
  onDetach: () => void;
}) {
  if (!item) return <p className="text-xs text-muted-foreground">This clip's media was removed.</p>;
  const visual = onTrackKind !== "audio" && item.kind !== "audio";
  const audible = item.hasAudio;
  const maxFade = Math.max(0, Math.min(10, clip.duration / 2));
  return (
    <>
      <div className="text-xs space-y-0.5">
        <p className="font-bold truncate" title={item.name}>
          {item.name}
        </p>
        <p className="text-muted-foreground font-mono">
          {fmtTime(clip.start)} → {fmtTime(clipEnd(clip))} ({clip.duration.toFixed(2)}s)
        </p>
      </div>
      {audible && (
        <>
          <Slider label="Volume" value={clip.volume} min={0} max={2} step={0.01} format={pct} onLive={(v) => onLive({ volume: v })} onCommit={onCommit} />
          {visual && clip.volume > 0 && (
            <button type="button" className="w-full text-xs font-bold border-2 border-foreground px-3 py-1.5 hover:bg-muted" onClick={onDetach}>
              Detach audio to its own track
            </button>
          )}
        </>
      )}
      {maxFade > 0 && (
        <>
          <Slider label="Fade in" value={Math.min(clip.fadeIn, maxFade)} min={0} max={maxFade} step={0.1} format={secs} onLive={(v) => onLive({ fadeIn: v })} onCommit={onCommit} />
          <Slider label="Fade out" value={Math.min(clip.fadeOut, maxFade)} min={0} max={maxFade} step={0.1} format={secs} onLive={(v) => onLive({ fadeOut: v })} onCommit={onCommit} />
        </>
      )}
      {visual && <TransformControls clip={clip} onLive={onLive} onCommit={onCommit} onPatch={onPatch} withScale />}
      {item.kind === "image" && (
        <p className="text-[11px] text-muted-foreground">Drag the clip's right edge on the timeline to change how long it shows.</p>
      )}
    </>
  );
}

function TextInspector({
  clip,
  onLive,
  onCommit,
  onPatch,
}: {
  clip: TextClip;
  onLive: (p: Partial<TextClip>) => void;
  onCommit: () => void;
  onPatch: (p: Partial<TextClip>) => void;
}) {
  return (
    <>
      <label className="block space-y-1">
        <span className="text-xs font-bold">Text</span>
        <textarea
          value={clip.text}
          rows={3}
          onChange={(e) => onLive({ text: e.target.value })}
          onBlur={onCommit}
          className="input-field w-full text-sm"
        />
      </label>
      <Slider label="Size" value={clip.size} min={16} max={300} step={1} format={(v) => `${v}px`} onLive={(v) => onLive({ size: v })} onCommit={onCommit} />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs font-bold">
          Color
          <input type="color" value={clip.color} onChange={(e) => onLive({ color: e.target.value })} onBlur={onCommit} />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold">
          <input type="checkbox" checked={clip.bold} onChange={(e) => onPatch({ bold: e.target.checked })} />
          Bold
        </label>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs font-bold">
          <input
            type="checkbox"
            checked={!!clip.background}
            onChange={(e) => onPatch({ background: e.target.checked ? "#000000" : null })}
          />
          Background
        </label>
        {clip.background && (
          <input type="color" value={clip.background} onChange={(e) => onLive({ background: e.target.value })} onBlur={onCommit} />
        )}
      </div>
      <TransformControls clip={clip} onLive={onLive} onCommit={onCommit} onPatch={onPatch} withScale={false} />
    </>
  );
}

function ProjectInspector({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const preset = RESOLUTIONS.find((r) => r.w === project.width && r.h === project.height);
  return (
    <>
      <label className="block space-y-1">
        <span className="text-xs font-bold">Frame size</span>
        <select
          className="input-field w-full text-sm"
          value={preset ? `${preset.w}x${preset.h}` : "custom"}
          onChange={(e) => {
            const r = RESOLUTIONS.find((x) => `${x.w}x${x.h}` === e.target.value);
            if (r) onChange({ width: r.w, height: r.h });
          }}
        >
          {!preset && (
            <option value="custom">
              From video ({project.width}×{project.height})
            </option>
          )}
          {RESOLUTIONS.map((r) => (
            <option key={r.label} value={`${r.w}x${r.h}`}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold">Frame rate</span>
        <select className="input-field w-full text-sm" value={project.fps} onChange={(e) => onChange({ fps: Number(e.target.value) })}>
          {[24, 25, 30, 50, 60].map((f) => (
            <option key={f} value={f}>
              {f} fps
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-bold">
        Background
        <input type="color" value={project.background} onChange={(e) => onChange({ background: e.target.value })} />
      </label>
      <p className="text-[11px] text-muted-foreground">Select a clip on the timeline or in the preview to edit it.</p>
    </>
  );
}

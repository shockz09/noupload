import { Link, createFileRoute } from "@tanstack/react-router";

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
import { fmtTime, type Gesture, TRACK_HEADER_W, Timeline } from "@/components/video-editor/Timeline";
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RotateLeftIcon,
  RotateRightIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons/ui";
import { VideoEditorIcon, VideoTrimIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, ProgressBar, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useFileBuffer } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { DraftRecoveryDialog } from "@/components/shared/DraftRecoveryDialog";
import {
  type VideoEditorDraft,
  clearDraft,
  deleteMediaFile,
  loadDraft,
  peekDraft,
  saveDraft,
  saveMediaFile,
} from "@/lib/video/editor/draft";
import {
  type ExportFormat,
  type ExportQuality,
  type ExportResult,
  type ExportSettings,
  exportBitrates,
  exportProject,
  exportSize,
} from "@/lib/video/editor/export";
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
const MIN_PPS = 4;
const MAX_PPS = 400;
// The zoom slider is logarithmic so each notch feels the same at any zoom level.
const zoomToSlider = (pps: number) => Math.log(pps / MIN_PPS) / Math.log(MAX_PPS / MIN_PPS);
const sliderToZoom = (v: number) => MIN_PPS * (MAX_PPS / MIN_PPS) ** v;

const RESOLUTIONS = [
  { label: "1080p landscape (1920×1080)", short: "1080p", w: 1920, h: 1080 },
  { label: "720p landscape (1280×720)", short: "720p", w: 1280, h: 720 },
  { label: "4K landscape (3840×2160)", short: "4K", w: 3840, h: 2160 },
  { label: "Vertical 1080×1920", short: "9:16", w: 1080, h: 1920 },
  { label: "Square 1080×1080", short: "1:1", w: 1080, h: 1080 },
  { label: "Portrait 4:5 (1080×1350)", short: "4:5", w: 1080, h: 1350 },
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
  const [result, setResult] = useState<ExportResult | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: "mp4",
    resolution: Number.POSITIVE_INFINITY,
    quality: "standard",
  });
  const exportAbort = useRef<AbortController | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const mediaListRef = useRef(mediaList);
  mediaListRef.current = mediaList;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
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
    if (!canvas || !hasMedia) return;
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
  }, [hasMedia]);

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

  // Listening to a bin item and playing the timeline are exclusive.
  const binPreview = useBinPreview(useCallback(() => engineRef.current?.pause(), []));
  const stopBinPreview = binPreview.stop;
  const binPlayingRef = useRef(false);
  binPlayingRef.current = binPreview.playing;
  useEffect(() => {
    if (playing) stopBinPreview();
  }, [playing, stopBinPreview]);

  // ── Autosave ───────────────────────────────────────────────
  // Same contract as the PDF editor: the edit lives in IndexedDB until the user
  // starts fresh, so a closed tab or a reload offers to resume it.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingDraft, setPendingDraft] = useState<VideoEditorDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  /** In-flight media file writes by media id; each settles without rejecting. */
  const fileWrites = useRef(new Map<string, Promise<void>>());
  const failedFiles = useRef(new Set<string>());
  /** Bumped whenever the draft is cleared, so a save already underway doesn't bring it back. */
  const saveGen = useRef(0);
  const sizedFromMedia = useRef(false);

  useEffect(() => {
    peekDraft()
      .then((d) => {
        if (d) setPendingDraft(d);
        else setDraftChecked(true);
      })
      .catch(() => setDraftChecked(true));
  }, []);

  const storeFile = useCallback((item: MediaItem) => {
    const write = saveMediaFile(item.id, item.file).then(
      () => {
        failedFiles.current.delete(item.id);
      },
      () => {
        failedFiles.current.add(item.id);
      },
    );
    fileWrites.current.set(item.id, write);
  }, []);

  const forgetStoredFile = useCallback((id: string) => {
    fileWrites.current.delete(id);
    failedFiles.current.delete(id);
    deleteMediaFile(id).catch(() => {});
  }, []);

  const wipeDraft = useCallback(() => {
    saveGen.current++;
    fileWrites.current.clear();
    failedFiles.current.clear();
    setSaveState("idle");
    clearDraft().catch(() => {});
  }, []);

  const persist = useCallback(async () => {
    const gen = saveGen.current;
    setSaveState("saving");
    await Promise.all(fileWrites.current.values());
    if (gen !== saveGen.current) return;
    try {
      await saveDraft(projectRef.current, mediaListRef.current, timeRef.current, ppsRef.current, fileWrites.current.keys());
      if (gen === saveGen.current) setSaveState(failedFiles.current.size > 0 ? "error" : "saved");
    } catch {
      if (gen === saveGen.current) setSaveState("error");
    }
  }, []);

  const resumeDraft = useCallback(async () => {
    const loaded = await loadDraft().catch(() => null);
    setPendingDraft(null);
    setDraftChecked(true);
    if (!loaded) return;
    const { draft, media: items } = loaded;
    const known = new Set(items.map((m) => m.id));
    const project = {
      ...draft.project,
      clips: draft.project.clips.filter((c) => c.type !== "media" || known.has(c.mediaId)),
    };
    sizedFromMedia.current = true;
    setMediaList(items);
    setHist({ past: [], present: project, future: [] });
    setPps(draft.pps);
    setTime(draft.time);
    timeRef.current = draft.time;
    if (items.length < draft.media.length) {
      setError("Some media from your last session couldn't be restored and was left out.");
    }
  }, []);

  const discardDraft = useCallback(async () => {
    setPendingDraft(null);
    await clearDraft().catch(() => {});
    setDraftChecked(true);
  }, []);

  const hasContent = mediaList.length > 0 || project.clips.length > 0;
  const canSave = draftChecked && hasContent;
  const canSaveRef = useRef(canSave);
  canSaveRef.current = canSave;

  useEffect(() => {
    if (!draftChecked) return;
    if (!hasContent) {
      // Everything was removed: nothing left to resume.
      wipeDraft();
      return;
    }
    const timer = setTimeout(persist, 600);
    return () => clearTimeout(timer);
  }, [draftChecked, hasContent, project, mediaList, pps, persist, wipeDraft]);

  // A closing or backgrounded tab saves straight away instead of waiting on the debounce.
  useEffect(() => {
    const flush = () => {
      if (canSaveRef.current) void persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [persist]);

  // ── Import ─────────────────────────────────────────────────
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
          storeFile(item);
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
    [storeFile],
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
      stopBinPreview(item.id);
      forgetMedia(item);
      forgetStoredFile(item.id);
    },
    [commit, forgetStoredFile, stopBinPreview],
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
  const openExport = useCallback(() => {
    engineRef.current?.pause();
    setExportOpen(true);
  }, []);

  const runExport = useCallback(async (settings: ExportSettings) => {
    engineRef.current?.pause();
    setExportOpen(false);
    setExportSettings(settings);
    setError(null);
    setExportProgress(0);
    const abort = new AbortController();
    exportAbort.current = abort;
    try {
      const out = await exportProject(projectRef.current, media, settings, {
        onProgress: (p) => setExportProgress(p),
        signal: abort.signal,
      });
      setResult(out);
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
      if (result) downloadBlob(result.blob, `edited-video.${result.format}`, result.blob.type);
    },
    [result],
  );

  const { add: addToBuffer } = useFileBuffer();
  const holdInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: `edited-video.${result.format}`,
      blob: result.blob,
      mimeType: result.blob.type,
      size: result.blob.size,
      fileType: "video",
      sourceToolLabel: "Video Editor",
    });
  }, [result, addToBuffer]);

  const timelineWrapRef = useRef<HTMLDivElement>(null);
  const fitTimeline = useCallback(() => {
    const w = (timelineWrapRef.current?.clientWidth ?? 1000) - TRACK_HEADER_W - 24;
    const d = projectDuration(projectRef.current) || 10;
    setPps(Math.min(MAX_PPS, Math.max(MIN_PPS, w / (d * 1.05))));
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    if (!hasMedia || result || exportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const fps = projectRef.current.fps;
      if (e.code === "Space") {
        e.preventDefault();
        // Space stops a bin preview first, then drives the timeline.
        if (binPlayingRef.current) stopBinPreview();
        else togglePlay();
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
  }, [hasMedia, result, exportOpen, togglePlay, undo, redo, duplicateSelected, splitAtPlayhead, addText, deleteSelected, seek, stopBinPreview]);

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
  const exportFrame = exportSize(project, exportSettings.resolution);

  // ── Workspace layout ───────────────────────────────────────
  const workspace = hasMedia;
  useEffect(() => {
    if (!workspace) return;
    // The editor owns the viewport; the page behind it must not scroll.
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [workspace]);

  const [timelineH, setTimelineH] = useState(300);
  useEffect(() => {
    setTimelineH(Math.round(Math.min(420, Math.max(220, window.innerHeight * 0.36))));
  }, []);
  const onSplitterDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const y0 = e.clientY;
      const h0 = timelineH;
      const move = (ev: PointerEvent) =>
        setTimelineH(Math.round(Math.min(window.innerHeight - 320, Math.max(160, h0 - (ev.clientY - y0)))));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [timelineH],
  );

  // Fit the canvas inside the stage at the project's aspect ratio.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setStage({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [workspace]);
  const aspect = project.width / project.height;
  const canvasW = Math.max(0, Math.floor(Math.min(stage.w, stage.h * aspect)));
  const canvasH = Math.max(0, Math.floor(canvasW / aspect));

  const [showKeys, setShowKeys] = useState(false);

  const startFresh = useCallback(() => {
    if (!window.confirm("Start a new project? This clears the current edit and its media from this device.")) return;
    engineRef.current?.pause();
    for (const m of mediaListRef.current) forgetMedia(m);
    wipeDraft();
    setMediaList([]);
    setHist({ past: [], present: createProject(), future: [] });
    setSelectedId(null);
    setResult(null);
    setTime(0);
    sizedFromMedia.current = false;
  }, [wipeDraft]);

  if (!workspace) {
    return (
      <div className="page-enter space-y-8">
        <VideoPageHeader
          icon={<VideoEditorIcon className="w-7 h-7" />}
          iconClass="tool-video-editor"
          title="Video Editor"
          description="Multi-track editing with audio, text and images — all in your browser"
        />
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
          <DraftRecoveryDialog
            open={!!pendingDraft}
            savedAt={pendingDraft?.savedAt ?? 0}
            onResume={resumeDraft}
            onDiscard={discardDraft}
          />
          <InfoBox>
            Arrange clips on video, audio and text tracks, trim and split them, then export an MP4. Your edit autosaves on
            this device, so you can close the tab and pick up where you left off. Nothing is uploaded.
          </InfoBox>
        </div>
      </div>
    );
  }

  const panelTitle = "h-10 shrink-0 flex items-center justify-between gap-2 px-3 border-b-2 border-foreground bg-muted";
  const kicker = "text-[11px] font-bold uppercase tracking-[0.14em]";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground select-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onEditorDrop}
    >
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-3 border-b-2 border-foreground bg-card">
        <Link
          to="/video"
          title="Back to video tools — your edit stays saved on this device"
          className="w-9 h-9 border-2 border-foreground flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div className="tool-video-editor w-9 h-9 border-2 border-foreground flex items-center justify-center text-white bg-[var(--tool-color)]">
          <VideoEditorIcon className="w-5 h-5" />
        </div>
        <h1 className="font-display text-2xl leading-none">Video Editor</h1>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          title="Project settings"
          className="hidden md:inline-flex items-center gap-2 ml-2 h-8 px-3 border-2 border-foreground bg-background hover:bg-accent text-xs font-bold font-mono transition-colors"
        >
          {project.width}×{project.height} · {project.fps}fps
        </button>
        <SaveBadge state={saveState} />

        <div className="flex-1" />

        <button
          type="button"
          onClick={startFresh}
          title="Clear this edit and start over"
          className="hidden md:inline-flex h-9 items-center px-3 border-2 border-foreground bg-card hover:bg-muted text-xs font-bold transition-colors"
        >
          New project
        </button>
        <div className="flex items-center">
          <IconButton onClick={undo} disabled={!hist.past.length} title="Undo (⌘Z)" className="border-r-0">
            <RotateLeftIcon className="w-4 h-4" />
          </IconButton>
          <IconButton onClick={redo} disabled={!hist.future.length} title="Redo (⇧⌘Z)">
            <RotateRightIcon className="w-4 h-4" />
          </IconButton>
        </div>
        <div className="relative">
          <IconButton onClick={() => setShowKeys((v) => !v)} title="Keyboard shortcuts" active={showKeys}>
            <span className="text-sm font-bold">?</span>
          </IconButton>
          {showKeys && <ShortcutsCard onClose={() => setShowKeys(false)} />}
        </div>
        <button
          type="button"
          onClick={openExport}
          disabled={duration <= 0 || exporting}
          className="h-9 px-4 inline-flex items-center gap-2 border-2 border-foreground bg-primary text-primary-foreground text-sm font-bold shadow-[3px_3px_0_0_var(--foreground)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--foreground)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
        >
          <DownloadIcon className="w-4 h-4" />
          Export
        </button>
      </header>

      {/* ── Work area ── */}
      <div className="flex-1 min-h-0 flex">
        {/* Media bin */}
        <aside className="w-52 xl:w-64 shrink-0 flex flex-col border-r-2 border-foreground bg-card">
          <div className={panelTitle}>
            <span className={kicker}>Media</span>
            <span className="text-[11px] font-mono text-muted-foreground">{mediaList.length}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video border-2 border-dashed border-foreground/50 hover:border-foreground hover:bg-accent flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-lg font-bold leading-none">+</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Import</span>
              </button>
              {mediaList.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  preview={binPreview}
                  onAdd={addMediaToTimeline}
                  onRemove={removeMedia}
                />
              ))}
              {Array.from({ length: importing }, (_, i) => (
                <div key={`loading-${i}`} className="aspect-video border-2 border-foreground/30 bg-muted animate-pulse" />
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Drag onto a track, or hit + to drop it at the playhead. You can also drop files anywhere.
            </p>
          </div>
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
        </aside>

        {/* Preview */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div
            className="flex-1 min-h-0 p-5 bg-muted"
            style={{
              backgroundImage: "radial-gradient(color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          >
            <div ref={stageRef} className="w-full h-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                onPointerDown={onCanvasDown}
                className="block border-2 border-foreground bg-black shadow-[6px_6px_0_0_var(--foreground)]"
                style={{ width: canvasW, height: canvasH }}
              />
            </div>
          </div>
          <div className="h-14 shrink-0 flex items-center gap-2 px-3 border-t-2 border-foreground bg-card">
            <IconButton onClick={() => seek(0)} title="Go to start (Home)">
              <SkipIcon className="w-4 h-4 rotate-180" />
            </IconButton>
            <button
              type="button"
              onClick={togglePlay}
              title="Play/Pause (Space)"
              className="w-11 h-11 border-2 border-foreground bg-primary text-primary-foreground flex items-center justify-center shadow-[3px_3px_0_0_var(--foreground)] hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
            </button>
            <IconButton onClick={() => seek(duration)} title="Go to end (End)">
              <SkipIcon className="w-4 h-4" />
            </IconButton>
            <div className="ml-2 font-mono text-sm tabular-nums">
              <span className="font-bold">{fmtTime(time, project.fps)}</span>
              <span className="text-muted-foreground"> / {fmtTime(duration, project.fps)}</span>
            </div>
          </div>
        </main>

        {/* Inspector */}
        <aside className="w-64 xl:w-72 shrink-0 flex flex-col border-l-2 border-foreground bg-card">
          <div className={panelTitle}>
            <span className={kicker}>{selected ? (selected.type === "text" ? "Text" : "Clip") : "Project"}</span>
            {selected && (
              <div className="flex items-center gap-1">
                <MiniButton onClick={splitAtPlayhead} title="Split at playhead (S)">
                  <VideoTrimIcon className="w-3.5 h-3.5" />
                </MiniButton>
                <MiniButton onClick={duplicateSelected} title="Duplicate (⌘D)">
                  <CopyIcon className="w-3.5 h-3.5" />
                </MiniButton>
                <MiniButton onClick={deleteSelected} title="Delete (⌫)" danger>
                  <TrashIcon className="w-3.5 h-3.5" />
                </MiniButton>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto select-text">
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
          </div>
        </aside>
      </div>

      {/* ── Splitter ── */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        aria-valuenow={timelineH}
        aria-valuemin={160}
        aria-valuemax={1200}
        tabIndex={0}
        onPointerDown={onSplitterDown}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          e.stopPropagation();
          setTimelineH((h) => Math.min(window.innerHeight - 320, Math.max(160, h + (e.key === "ArrowUp" ? 24 : -24))));
        }}
        className="h-2.5 shrink-0 border-y-2 border-foreground bg-muted cursor-row-resize flex items-center justify-center hover:bg-accent group"
      >
        <div className="w-10 h-0.5 bg-foreground/40 group-hover:bg-foreground" />
      </div>

      {/* ── Timeline ── */}
      <section ref={timelineWrapRef} className="shrink-0 flex flex-col bg-card" style={{ height: timelineH }}>
        <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b-2 border-foreground">
          <ToolButton onClick={splitAtPlayhead} title="Split at playhead (S)">
            <VideoTrimIcon className="w-3.5 h-3.5" /> Split
          </ToolButton>
          <ToolButton onClick={addText} title="Add text (T)">
            <span className="font-display text-base leading-none">T</span> Text
          </ToolButton>
          <ToolButton onClick={deleteSelected} disabled={!selectedId} title="Delete selected (⌫)" danger>
            <TrashIcon className="w-3.5 h-3.5" /> Delete
          </ToolButton>
          <div className="w-px h-6 bg-foreground/20 mx-1" />
          <ToolButton onClick={() => addTrack("video")}>+ Video track</ToolButton>
          <ToolButton onClick={() => addTrack("audio")}>+ Audio track</ToolButton>
          <div className="flex-1" />
          <div className="flex items-center h-8 border-2 border-foreground bg-background">
            <button
              type="button"
              title="Zoom out"
              onClick={() => setPps((z) => Math.max(MIN_PPS, z / 1.5))}
              className="w-7 h-full font-bold hover:bg-muted border-r-2 border-foreground"
            >
              −
            </button>
            <input
              type="range"
              aria-label="Timeline zoom"
              min={0}
              max={1}
              step={0.001}
              value={zoomToSlider(pps)}
              onChange={(e) => setPps(sliderToZoom(Number(e.target.value)))}
              className="range-brutal w-24 mx-2.5"
              style={fill(zoomToSlider(pps), 0, 1)}
            />
            <button
              type="button"
              title="Zoom in"
              onClick={() => setPps((z) => Math.min(MAX_PPS, z * 1.5))}
              className="w-7 h-full font-bold hover:bg-muted border-l-2 border-foreground"
            >
              +
            </button>
            <button
              type="button"
              title="Fit the whole project"
              onClick={fitTimeline}
              className="h-full px-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted border-l-2 border-foreground"
            >
              Fit
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
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
        </div>
      </section>

      {/* ── Overlays ── */}
      {error && (
        <div className="absolute left-4 bottom-4 z-30 max-w-md flex items-start gap-2 border-2 border-foreground bg-card p-3 shadow-[4px_4px_0_0_var(--foreground)]">
          <AlertIcon className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <p className="text-sm flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} title="Dismiss" className="shrink-0 hover:text-destructive">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {exportOpen && (
        <ExportDialog
          project={project}
          duration={duration}
          hasAudio={project.clips.some((c) => c.type === "media" && c.volume > 0 && !!media.get(c.mediaId)?.hasAudio)}
          settings={exportSettings}
          onChange={setExportSettings}
          onCancel={() => setExportOpen(false)}
          onExport={runExport}
        />
      )}

      {exporting && (
        <Modal>
          <p className={kicker}>Exporting</p>
          <h2 className="font-display text-3xl mt-1 mb-5">Rendering your video…</h2>
          <ProgressBar
            progress={Math.round((exportProgress ?? 0) * 100)}
            label={`${Math.round((exportProgress ?? 0) * 100)}% · ${exportSettings.format.toUpperCase()} · ${exportFrame.width}×${exportFrame.height} · ${fmtTime(duration)}`}
          />
          <button type="button" className="btn-secondary w-full mt-5" onClick={() => exportAbort.current?.abort()}>
            Cancel
          </button>
        </Modal>
      )}

      {result && (
        <Modal wide>
          <VideoResultView
            blob={result.blob}
            title="Video Exported!"
            subtitle={`${result.format.toUpperCase()} · ${result.width}×${result.height} · ${fmtTime(duration)}`}
            downloadLabel="Download Video"
            onDownload={download}
            onHoldInBuffer={holdInBuffer}
            onStartOver={() => setResult(null)}
            startOverLabel="Back to Editor"
          />
        </Modal>
      )}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────

function IconButton({
  children,
  onClick,
  disabled,
  title,
  active,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`w-9 h-9 border-2 border-foreground flex items-center justify-center transition-colors disabled:text-foreground/30 disabled:pointer-events-none ${
        active ? "bg-foreground text-background" : "bg-card hover:bg-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const text = state === "saving" ? "Saving…" : state === "saved" ? "Saved on this device" : "Not saved on this device";
  return (
    <span
      title={
        state === "error"
          ? "The browser refused to store the edit, usually because disk space is low. Editing still works until you close the tab."
          : undefined
      }
      className={`hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold ${
        state === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {state === "saved" && <CheckIcon className="w-3.5 h-3.5" />}
      {state === "error" && <AlertIcon className="w-3.5 h-3.5" />}
      {text}
    </span>
  );
}

function MiniButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-7 h-7 border-2 border-foreground bg-card flex items-center justify-center transition-colors ${
        danger ? "hover:bg-destructive hover:text-white" : "hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function SkipIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 4 15 12 5 20 5 4" />
      <rect x="17" y="4" width="2.5" height="16" />
    </svg>
  );
}

function Modal({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-foreground/40">
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-full overflow-y-auto border-2 border-foreground bg-background p-6 shadow-[8px_8px_0_0_var(--foreground)] select-text`}
      >
        {children}
      </div>
    </div>
  );
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "mp4", label: "MP4", hint: "Plays everywhere: YouTube, Instagram, TikTok, WhatsApp." },
  { value: "webm", label: "WebM", hint: "Smaller files for the web. VP9 video, Opus audio." },
  { value: "mov", label: "MOV", hint: "QuickTime, for Mac and Final Cut workflows." },
];

const QUALITY_OPTIONS: { value: ExportQuality; label: string; hint: string }[] = [
  { value: "high", label: "High", hint: "Best picture, biggest file." },
  { value: "standard", label: "Standard", hint: "Looks great at a sensible size." },
  { value: "small", label: "Small", hint: "For sharing in chats and email." },
];

const RESOLUTION_STEPS = [2160, 1440, 1080, 720, 480];
const resolutionLabel = (short: number) => (short === 2160 ? "4K" : `${short}p`);

function fmtBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.max(1, Math.round(n / 1e6))} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

function ExportDialog({
  project,
  duration,
  hasAudio,
  settings,
  onChange,
  onCancel,
  onExport,
}: {
  project: Project;
  duration: number;
  hasAudio: boolean;
  settings: ExportSettings;
  onChange: React.Dispatch<React.SetStateAction<ExportSettings>>;
  onCancel: () => void;
  /** Called with the settings as shown, so a resolution the project no longer offers falls back to full size. */
  onExport: (settings: ExportSettings) => void;
}) {
  const short = Math.min(project.width, project.height);
  // "Full" is the project size; smaller steps are downscales, never upscales.
  const resolutions = [
    { value: Number.POSITIVE_INFINITY, label: resolutionLabel(short), title: "Project size" },
    ...RESOLUTION_STEPS.filter((r) => r < short).map((r) => ({ value: r, label: resolutionLabel(r), title: undefined })),
  ].slice(0, 4);
  const resolution = resolutions.some((r) => r.value === settings.resolution) ? settings.resolution : resolutions[0].value;
  const size = exportSize(project, resolution);
  const rates = exportBitrates(size.width, size.height, project.fps, settings.quality);
  const bytes = ((rates.video + (hasAudio ? rates.audio : 0)) * duration) / 8;
  const set = (patch: Partial<ExportSettings>) => onChange((s) => ({ ...s, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const label = "font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground";
  return (
    <Modal>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Export</p>
      <h2 className="font-display text-3xl mt-1 mb-5">Export your video</h2>

      <div className="space-y-5">
        <div className="space-y-2">
          <h3 className={label}>Format</h3>
          <Segmented options={FORMAT_OPTIONS} value={settings.format} onChange={(format) => set({ format })} />
          <p className="text-xs text-muted-foreground">{FORMAT_OPTIONS.find((o) => o.value === settings.format)?.hint}</p>
        </div>

        <div className="space-y-2">
          <h3 className={label}>Resolution</h3>
          <Segmented options={resolutions} value={resolution} onChange={(r) => set({ resolution: r })} />
        </div>

        <div className="space-y-2">
          <h3 className={label}>Quality</h3>
          <Segmented options={QUALITY_OPTIONS} value={settings.quality} onChange={(quality) => set({ quality })} />
          <p className="text-xs text-muted-foreground">{QUALITY_OPTIONS.find((o) => o.value === settings.quality)?.hint}</p>
        </div>

        <div className="grid grid-cols-3 border-2 border-foreground bg-card divide-x-2 divide-foreground">
          {[
            ["Frame", `${size.width}×${size.height}`],
            ["Length", fmtTime(duration)],
            ["File", `≈ ${fmtBytes(bytes)}`],
          ].map(([k, v]) => (
            <div key={k} className="px-3 py-2 min-w-0">
              <p className={label}>{k}</p>
              <p className="font-mono text-sm font-bold tabular-nums truncate">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => onExport({ ...settings, resolution })}
        >
          <DownloadIcon className="w-4 h-4" />
          Export {settings.format.toUpperCase()}
        </button>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["S", "Split at playhead"],
  ["T", "Add text"],
  ["⌫", "Delete clip"],
  ["⌘D", "Duplicate clip"],
  ["⌘Z / ⇧⌘Z", "Undo / redo"],
  ["← →", "Step one frame"],
  ["⇧← ⇧→", "Step one second"],
  ["Home / End", "Jump to start / end"],
  ["⌘ + scroll", "Zoom timeline"],
];

function ShortcutsCard({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-shortcuts]")) onClose();
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [onClose]);
  return (
    <div
      data-shortcuts
      className="absolute right-0 top-11 z-40 w-72 border-2 border-foreground bg-card p-4 shadow-[5px_5px_0_0_var(--foreground)]"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3">Shortcuts</p>
      <dl className="space-y-1.5">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-muted-foreground">{v}</dt>
            <dd>
              <kbd className="font-mono text-[11px] font-bold border-2 border-foreground bg-background px-1.5 py-px">{k}</kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 pt-3 border-t border-foreground/20 text-[11px] text-muted-foreground">
        Drag clips in the preview to move them.
      </p>
    </div>
  );
}

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
      className={`h-8 inline-flex items-center gap-1.5 text-xs font-bold border-2 border-foreground bg-background px-2.5 transition-colors disabled:opacity-35 disabled:pointer-events-none ${
        danger ? "hover:bg-destructive hover:text-white" : "hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

interface BinPreview {
  id: string | null;
  playing: boolean;
  /** Seconds into the previewed item. */
  time: number;
  toggle: (item: MediaItem) => void;
  playFrom: (item: MediaItem, t: number) => void;
  /** Stop the preview, or only if it is playing `id`. */
  stop: (id?: string) => void;
}

/** One shared <audio> element for listening to bin items before they go on the timeline. */
function useBinPreview(onStart: () => void): BinPreview {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const idRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const [id, setId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  const stop = useCallback((only?: string) => {
    if (only && idRef.current !== only) return;
    cancelAnimationFrame(rafRef.current);
    const el = elRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    idRef.current = null;
    setId(null);
    setPlaying(false);
    setTime(0);
  }, []);

  const playFrom = useCallback(
    (item: MediaItem, t: number) => {
      if (!elRef.current) {
        const el = new Audio();
        el.addEventListener("play", () => setPlaying(true));
        el.addEventListener("pause", () => setPlaying(false));
        el.addEventListener("ended", () => setTime(0));
        elRef.current = el;
      }
      const el = elRef.current;
      if (idRef.current !== item.id) {
        el.src = item.url;
        idRef.current = item.id;
        setId(item.id);
      }
      el.currentTime = Math.max(0, Math.min(t, item.duration));
      setTime(el.currentTime);
      onStart();
      el.play().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      const tick = () => {
        setTime(el.currentTime);
        if (!el.paused) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [onStart],
  );

  const toggle = useCallback(
    (item: MediaItem) => {
      const el = elRef.current;
      if (el && idRef.current === item.id && !el.paused) {
        el.pause();
        return;
      }
      // Resume where it paused; after the end, start over.
      playFrom(item, idRef.current === item.id && el && !el.ended ? el.currentTime : 0);
    },
    [playFrom],
  );

  useEffect(() => () => stop(), [stop]);

  return useMemo(() => ({ id, playing, time, toggle, playFrom, stop }), [id, playing, time, toggle, playFrom, stop]);
}

function MediaCard({
  item,
  preview,
  onAdd,
  onRemove,
}: {
  item: MediaItem;
  preview: BinPreview;
  onAdd: (id: string) => void;
  onRemove: (item: MediaItem) => void;
}) {
  const thumb = item.kind === "video" ? item.thumbs.find(Boolean) : item.kind === "image" ? item.url : null;
  const isAudio = item.kind === "audio";
  const active = preview.id === item.id;
  const listening = active && preview.playing;
  const progress = active && item.duration > 0 ? preview.time / item.duration : 0;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-editor-media", item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="group min-w-0 cursor-grab active:cursor-grabbing"
    >
      <div
        className={`relative aspect-video border-2 border-foreground bg-muted overflow-hidden transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[3px_3px_0_0_var(--foreground)] ${
          active ? "shadow-[3px_3px_0_0_var(--primary)] -translate-x-0.5 -translate-y-0.5" : ""
        }`}
      >
        {thumb ? (
          <img src={thumb} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <button
            type="button"
            title="Click to listen from here"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              preview.playFrom(item, ((e.clientX - r.left) / r.width) * item.duration);
            }}
            className="block w-full h-full cursor-pointer"
          >
            <MiniWave peaks={item.peaks} progress={active ? progress : null} />
          </button>
        )}
        <span className="pointer-events-none absolute left-1 top-1 px-1 text-[9px] font-bold uppercase tracking-wider bg-card border border-foreground">
          {item.kind === "video" ? "Video" : isAudio ? "Audio" : "Image"}
        </span>
        {isAudio && (
          <button
            type="button"
            title={listening ? "Pause preview" : "Listen"}
            aria-label={listening ? "Pause preview" : "Listen"}
            onClick={() => preview.toggle(item)}
            className={`absolute left-1 bottom-1 w-6 h-6 flex items-center justify-center border-2 border-foreground transition-colors ${
              listening ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
            }`}
          >
            {listening ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3 translate-x-px" />}
          </button>
        )}
        {item.kind !== "image" && (
          <span className="pointer-events-none absolute right-1 bottom-1 px-1 text-[10px] font-mono font-bold bg-foreground text-background">
            {active ? fmtTime(preview.time) : fmtTime(item.duration)}
          </span>
        )}
        <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title="Remove from project"
            onClick={() => onRemove(item)}
            className="w-6 h-6 flex items-center justify-center border-2 border-foreground bg-card hover:bg-destructive hover:text-white"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Add at playhead"
            onClick={() => onAdd(item.id)}
            className="w-6 h-6 flex items-center justify-center border-2 border-foreground bg-primary text-primary-foreground font-bold leading-none"
          >
            +
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] font-bold truncate" title={item.name}>
        {item.name}
      </p>
      {item.kind === "video" && !item.hasAudio && <p className="text-[10px] text-muted-foreground -mt-0.5">No audio</p>}
    </div>
  );
}

function MiniWave({ peaks, progress }: { peaks: number[]; progress: number | null }) {
  const bars = useMemo(() => {
    const n = 28;
    return Array.from({ length: n }, (_, i) => peaks[Math.floor((i / n) * peaks.length)] ?? 0.2);
  }, [peaks]);
  return (
    <div className="relative w-full h-full flex items-center gap-[2px] px-2 bg-emerald-100">
      {bars.map((v, i) => (
        <div
          key={i}
          className={`flex-1 ${progress !== null && (i + 0.5) / bars.length <= progress ? "bg-primary" : "bg-emerald-700/70"}`}
          style={{ height: `${Math.max(8, v * 70)}%` }}
        />
      ))}
      {progress !== null && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary"
          style={{ left: `calc(0.5rem + ${Math.min(1, progress)} * (100% - 1rem))` }}
        />
      )}
    </div>
  );
}

// ── Inspector building blocks ────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="px-4 py-4 border-b-2 border-foreground/10 space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
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
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold">{label}</span>
        <span className="text-[11px] font-mono font-bold px-1.5 bg-muted border border-foreground/20 tabular-nums">
          {format(value)}
        </span>
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
        className="range-brutal w-full"
        style={fill(value, min, max)}
      />
    </label>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border-2 border-foreground bg-background">
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex-1 h-8 text-xs font-bold transition-colors ${i > 0 ? "border-l-2 border-foreground" : ""} ${
            o.value === value ? "bg-foreground text-background" : "hover:bg-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TEXT_COLORS = ["#ffffff", "#1a1612", "#facc15", "#c84c1c", "#38bdf8"];

function ColorField({
  value,
  onLive,
  onCommit,
  presets = TEXT_COLORS,
}: {
  value: string;
  onLive: (v: string) => void;
  onCommit: () => void;
  presets?: string[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => {
            onLive(c);
            onCommit();
          }}
          className={`w-6 h-6 border-2 border-foreground ${value.toLowerCase() === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        title="Custom colour"
        className="swatch-brutal ml-auto"
        value={value}
        onChange={(e) => onLive(e.target.value)}
        onBlur={onCommit}
      />
    </div>
  );
}

/** Track fill up to the thumb, for .range-brutal. */
const fill = (v: number, min: number, max: number) =>
  ({ "--fill": `${((v - min) / (max - min || 1)) * 100}%` }) as React.CSSProperties;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toFixed(1)}s`;

type TransformPatch = { x?: number; y?: number; opacity?: number; scale?: number };

function TransformSection({
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
    <Section
      title="Transform"
      action={
        <button
          type="button"
          className="text-[11px] font-bold underline underline-offset-2 text-muted-foreground hover:text-foreground"
          onClick={() => onPatch(withScale ? { x: 0.5, y: 0.5, scale: 1, opacity: 1 } : { x: 0.5, y: 0.5, opacity: 1 })}
        >
          Reset
        </button>
      }
    >
      {withScale && clip.type === "media" && (
        <Slider label="Scale" value={clip.scale} min={0.1} max={3} step={0.01} format={pct} onLive={(v) => onLive({ scale: v })} onCommit={onCommit} />
      )}
      <Slider label="Opacity" value={clip.opacity} min={0} max={1} step={0.01} format={pct} onLive={(v) => onLive({ opacity: v })} onCommit={onCommit} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="X" value={clip.x} min={-0.5} max={1.5} step={0.005} format={pct} onLive={(v) => onLive({ x: v })} onCommit={onCommit} />
        <Slider label="Y" value={clip.y} min={-0.5} max={1.5} step={0.005} format={pct} onLive={(v) => onLive({ y: v })} onCommit={onCommit} />
      </div>
      <p className="text-[11px] text-muted-foreground">Tip: drag it around in the preview.</p>
    </Section>
  );
}

function ClipSummary({ thumb, name, clip, kind }: { thumb?: string | null; name: string; clip: Clip; kind: string }) {
  return (
    <div className="px-4 py-4 border-b-2 border-foreground/10 flex items-center gap-3">
      <div className="w-16 aspect-video shrink-0 border-2 border-foreground bg-muted overflow-hidden flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{kind}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold truncate" title={name}>
          {name}
        </p>
        <p className="text-[11px] font-mono text-muted-foreground">
          {fmtTime(clip.start)} → {fmtTime(clipEnd(clip))} · {clip.duration.toFixed(1)}s
        </p>
      </div>
    </div>
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
  if (!item) return <p className="p-4 text-xs text-muted-foreground">This clip's media was removed.</p>;
  const visual = onTrackKind !== "audio" && item.kind !== "audio";
  const maxFade = Math.max(0, Math.min(10, clip.duration / 2));
  const thumb = item.kind === "video" ? item.thumbs.find(Boolean) : item.kind === "image" ? item.url : null;
  return (
    <>
      <ClipSummary thumb={visual ? thumb : null} name={item.name} clip={clip} kind={onTrackKind === "audio" ? "Audio" : item.kind} />
      {item.hasAudio && (
        <Section title="Audio">
          <Slider label="Volume" value={clip.volume} min={0} max={2} step={0.01} format={pct} onLive={(v) => onLive({ volume: v })} onCommit={onCommit} />
          {visual && clip.volume > 0 && (
            <button
              type="button"
              className="w-full h-8 text-xs font-bold border-2 border-foreground bg-background hover:bg-accent transition-colors"
              onClick={onDetach}
            >
              Detach audio to its own track
            </button>
          )}
        </Section>
      )}
      {maxFade > 0 && (
        <Section title="Fades">
          <div className="grid grid-cols-2 gap-3">
            <Slider label="In" value={Math.min(clip.fadeIn, maxFade)} min={0} max={maxFade} step={0.1} format={secs} onLive={(v) => onLive({ fadeIn: v })} onCommit={onCommit} />
            <Slider label="Out" value={Math.min(clip.fadeOut, maxFade)} min={0} max={maxFade} step={0.1} format={secs} onLive={(v) => onLive({ fadeOut: v })} onCommit={onCommit} />
          </div>
        </Section>
      )}
      {visual && <TransformSection clip={clip} onLive={onLive} onCommit={onCommit} onPatch={onPatch} withScale />}
      {item.kind === "image" && (
        <p className="px-4 py-3 text-[11px] text-muted-foreground">Drag the clip's right edge on the timeline to change how long it shows.</p>
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
      <Section title="Content">
        <textarea
          value={clip.text}
          rows={3}
          onChange={(e) => onLive({ text: e.target.value })}
          onBlur={onCommit}
          className="w-full resize-y border-2 border-foreground bg-background p-2.5 text-sm font-medium focus:outline-none focus:shadow-[3px_3px_0_0_var(--primary)] transition-shadow"
        />
      </Section>
      <Section title="Style">
        <Slider label="Size" value={clip.size} min={16} max={300} step={1} format={(v) => `${v}px`} onLive={(v) => onLive({ size: v })} onCommit={onCommit} />
        <div className="space-y-1.5">
          <span className="text-xs font-bold">Weight</span>
          <Segmented
            options={[
              { value: "regular", label: "Regular" },
              { value: "bold", label: <span className="font-black">Bold</span> },
            ]}
            value={clip.bold ? "bold" : "regular"}
            onChange={(v) => onPatch({ bold: v === "bold" })}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-bold">Colour</span>
          <ColorField value={clip.color} onLive={(c) => onLive({ color: c })} onCommit={onCommit} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-bold">Background</span>
          <Segmented
            options={[
              { value: "none", label: "None" },
              { value: "box", label: "Box" },
            ]}
            value={clip.background ? "box" : "none"}
            onChange={(v) => onPatch({ background: v === "box" ? "#1a1612" : null })}
          />
          {clip.background && (
            <ColorField value={clip.background} onLive={(c) => onLive({ background: c })} onCommit={onCommit} />
          )}
        </div>
      </Section>
      <TransformSection clip={clip} onLive={onLive} onCommit={onCommit} onPatch={onPatch} withScale={false} />
    </>
  );
}

function ProjectInspector({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const isPreset = RESOLUTIONS.some((r) => r.w === project.width && r.h === project.height);
  const duration = projectDuration(project);
  return (
    <>
      <Section title="Frame size">
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTIONS.map((r) => {
            const active = r.w === project.width && r.h === project.height;
            const a = r.w / r.h;
            const bw = a >= 1 ? 28 : 28 * a;
            const bh = a >= 1 ? 28 / a : 28;
            return (
              <button
                key={r.label}
                type="button"
                title={r.label}
                onClick={() => onChange({ width: r.w, height: r.h })}
                className={`h-16 flex flex-col items-center justify-center gap-1.5 border-2 border-foreground transition-colors ${
                  active ? "bg-foreground text-background" : "bg-background hover:bg-accent"
                }`}
              >
                <span className={`border-2 ${active ? "border-background" : "border-foreground"}`} style={{ width: bw, height: bh }} />
                <span className="text-[10px] font-bold leading-none">{r.short}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">
          {project.width}×{project.height}
          {!isPreset && " · from your video"}
        </p>
      </Section>
      <Section title="Frame rate">
        <Segmented
          options={[24, 25, 30, 50, 60].map((f) => ({ value: f, label: f, title: `${f} fps` }))}
          value={project.fps}
          onChange={(fps) => onChange({ fps })}
        />
      </Section>
      <Section title="Background">
        <ColorField
          value={project.background}
          presets={["#000000", "#ffffff", "#faf7f2", "#1a1612"]}
          onLive={(c) => onChange({ background: c })}
          onCommit={() => {}}
        />
      </Section>
      <div className="px-4 py-4 grid grid-cols-2 gap-2">
        <Stat label="Length" value={fmtTime(duration)} />
        <Stat label="Clips" value={String(project.clips.length)} />
      </div>
      <p className="px-4 pb-4 text-[11px] text-muted-foreground">Select a clip on the timeline or in the preview to edit it.</p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-foreground bg-background px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

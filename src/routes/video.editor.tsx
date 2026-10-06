import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/editor")({
  head: () => ({
    meta: [
      { title: "Free Online Video Editor - Multi-Track, No Upload | noupload" },
      {
        name: "description",
        content:
          "Edit video in your browser: multi-track timeline, keyframes, speed, crop, colour, transitions, text animations, auto captions and MP4 export. Nothing is uploaded.",
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
import { CaptionsDialog } from "@/components/video-editor/CaptionsDialog";
import { ContextMenu, type MenuItem, type MenuState } from "@/components/video-editor/ContextMenu";
import {
  type ClipActions,
  type MediaActions,
  MediaInspector,
  MultiInspector,
  ProjectInspector,
  Segmented,
  TextInspector,
  fill,
} from "@/components/video-editor/Inspector";
import { fmtTime, type Gesture, TRACK_HEADER_W, Timeline, type TimelineTarget } from "@/components/video-editor/Timeline";
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
import type { Cue } from "@/lib/caption/cues";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { DraftRecoveryDialog } from "@/components/shared/DraftRecoveryDialog";
import { clipPeak, mixForCaptions } from "@/lib/video/editor/audio";
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
import { captureFrame, forgetMedia, importMedia, loadVideoPeaks, mediaKindOf } from "@/lib/video/editor/media";
import {
  type AnimProp,
  type Clip,
  type MediaClip,
  type MediaItem,
  type Pose,
  type Project,
  type TextClip,
  type Track,
  FONT_STACKS,
  IMAGE_DEFAULT_DURATION,
  MAX_VOLUME,
  TEXT_DEFAULT_DURATION,
  applyPose,
  clipEnd,
  closeGap,
  createProject,
  findFreeStart,
  gapAt,
  geometryCorners,
  isAnimated,
  keyframeIndex,
  mapClip,
  newMediaClip,
  newTextClip,
  normalizeProject,
  partners,
  poseAt,
  projectDuration,
  removeClips,
  rippleDelete,
  rippleShift,
  setLink,
  setSpeed,
  sourceTime,
  splitClips,
  toggleKeyframe,
  trackKindFor,
  trimToTime,
  uid,
  updateClip,
  withLinked,
} from "@/lib/video/editor/model";
import { type Guide, HANDLE_HIT, PreviewEngine, rotateHandle } from "@/lib/video/editor/preview";
import { reverseRange } from "@/lib/video/editor/reverse";
import { AUDIO_EXTENSIONS, MEDIABUNNY_VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

const IMAGE_EXTENSIONS = ".png,.jpg,.jpeg,.webp,.gif,.avif,.bmp";
const ACCEPT = `${MEDIABUNNY_VIDEO_EXTENSIONS},${AUDIO_EXTENSIONS},${IMAGE_EXTENSIONS}`;
const HISTORY_LIMIT = 100;
const MIN_PPS = 4;
const MAX_PPS = 400;
const FREEZE_LENGTH = 2;
/** Screen pixels within which a dragged clip snaps to the frame's centre and edges. */
const SNAP_SCREEN_PX = 8;
// The zoom slider is logarithmic so each notch feels the same at any zoom level.
const zoomToSlider = (pps: number) => Math.log(pps / MIN_PPS) / Math.log(MAX_PPS / MIN_PPS);
const sliderToZoom = (v: number) => MIN_PPS * (MAX_PPS / MIN_PPS) ** v;

interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2);
}

/** Clips that are linked (or the same clip) count as one thing being selected. */
function groupCount(p: Project, ids: Iterable<string>) {
  const groups = new Set<string>();
  for (const id of ids) {
    const c = p.clips.find((x) => x.id === id);
    if (c) groups.add(c.linkId ?? c.id);
  }
  return groups.size;
}

/** Copy clips with fresh ids, keeping links inside the copied set. */
function cloneClips(clips: Clip[]): Clip[] {
  const links = new Map<string, string>();
  return clips.map((c) => {
    let linkId: string | null = null;
    if (c.linkId) {
      if (!links.has(c.linkId)) links.set(c.linkId, uid("l"));
      linkId = links.get(c.linkId)!;
    }
    return { ...c, id: uid("c"), linkId };
  });
}

/** Lay copied clips onto the timeline from `at`, each on its own track or the nearest free spot there. */
function placeClips(p: Project, clips: Clip[], at: number): { project: Project; ids: string[] } {
  if (!clips.length) return { project: p, ids: [] };
  const origin = Math.min(...clips.map((c) => c.start));
  let next = p;
  const ids: string[] = [];
  for (const c of cloneClips(clips)) {
    if (!next.tracks.some((t) => t.id === c.trackId)) continue;
    const start = findFreeStart(next, c.trackId, at + (c.start - origin), c.duration);
    next = { ...next, clips: [...next.clips, { ...c, start } as Clip] };
    ids.push(c.id);
  }
  return { project: next, ids };
}

function VideoEditorPage() {
  const [hist, setHist] = useState<History>(() => ({ past: [], present: createProject(), future: [] }));
  const project = hist.present;
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const media = useMemo(() => new Map(mediaList.map((m) => [m.id, m])), [mediaList]);
  const [selection, setSelection] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [pps, setPps] = useState(40);
  const [importing, setImporting] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: "mp4",
    resolution: Number.POSITIVE_INFINITY,
    quality: "standard",
  });
  const exportAbort = useRef<AbortController | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipboard = useRef<Clip[]>([]);
  const projectRef = useRef(project);
  projectRef.current = project;
  const mediaListRef = useRef(mediaList);
  mediaListRef.current = mediaList;
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const timeRef = useRef(time);
  timeRef.current = time;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const primaryRef = useRef(primaryId);
  primaryRef.current = primaryId;

  const duration = projectDuration(project);
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const selected = project.clips.find((c) => c.id === primaryId) ?? null;
  const groups = groupCount(project, selection);
  const tol = 0.5 / project.fps;

  const select = useCallback((ids: Iterable<string>, primary: string | null) => {
    const list = [...new Set(ids)];
    setSelection(list);
    setPrimaryId(primary && list.includes(primary) ? primary : (list[list.length - 1] ?? null));
  }, []);
  /** Select one clip and whatever is linked to it. */
  const selectClip = useCallback(
    (id: string | null) => select(id ? withLinked(projectRef.current, [id]) : [], id),
    [select],
  );

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
    engine.onPlayingChange = (on) => {
      setPlaying(on);
      setRate(engine.rate);
    };
    engine.setProject(projectRef.current, mediaRef.current);
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
    const engine = engineRef.current;
    if (!engine) return;
    engine.editingId = editingText;
    engine.requestDraw();
  }, [editingText]);

  // Drop selected ids whose clips are gone (undo, delete, media removed).
  useEffect(() => {
    const live = selection.filter((id) => project.clips.some((c) => c.id === id));
    if (live.length !== selection.length) select(live, primaryId);
    if (editingText && !project.clips.some((c) => c.id === editingText)) setEditingText(null);
  }, [project, selection, primaryId, select, editingText]);

  const seek = useCallback((t: number) => engineRef.current?.seek(t), []);
  const togglePlay = useCallback(() => engineRef.current?.toggle(), []);
  const shuttle = useCallback((dir: 1 | -1) => {
    const engine = engineRef.current;
    if (!engine) return;
    // Each press in the same direction doubles the speed, up to 8×.
    const next = engine.playing && Math.sign(engine.rate) === dir ? Math.max(-8, Math.min(8, engine.rate * 2)) : dir;
    engine.play(next);
    setRate(next);
  }, []);

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
    const project = normalizeProject({
      ...draft.project,
      clips: draft.project.clips.filter((c) => c.type !== "media" || known.has(c.mediaId)),
    });
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
  /** Bring a file into the bin; resolves with the new item, or null if it couldn't be read. */
  const importOne = useCallback(
    async (file: File): Promise<MediaItem | null> => {
      try {
        const item = await importMedia(file);
        setMediaList((list) => [...list, item]);
        mediaRef.current = new Map(mediaRef.current).set(item.id, item);
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
        return item;
      } catch (err) {
        setError(getErrorMessage(err, `Could not import "${file.name}".`));
        return null;
      }
    },
    [storeFile],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const usable = files.filter((f) => mediaKindOf(f));
      if (usable.length < files.length) setError("Some files were skipped: only video, audio and image files work here.");
      setImporting((n) => n + usable.length);
      for (const file of usable) {
        await importOne(file);
        setImporting((n) => n - 1);
      }
    },
    [importOne],
  );

  // ── Clip creation ──────────────────────────────────────────
  /** Add media at `t` on `trackId`, or the bottom-most compatible track at the playhead. */
  const addMediaToTimeline = useCallback(
    (mediaId: string, trackId?: string, t?: number) => {
      const item = mediaRef.current.get(mediaId);
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
        const dur = item.kind === "image" ? IMAGE_DEFAULT_DURATION : item.duration;
        const start = findFreeStart(p, track.id, t ?? timeRef.current, dur);
        return { ...p, clips: [...p.clips, newMediaClip({ id, trackId: track.id, mediaId: item.id, start, duration: dur })] };
      });
      selectClip(id);
    },
    [commit, selectClip],
  );

  const addText = useCallback(
    (at?: number) => {
      const id = uid("c");
      commit((p) => {
        let tracks = p.tracks;
        let track = tracks.find((t) => t.kind === "text");
        if (!track) {
          track = { id: uid("t"), kind: "text", name: "Text", muted: false, hidden: false };
          tracks = [track, ...tracks];
        }
        const next = { ...p, tracks };
        const start = findFreeStart(next, track.id, at ?? timeRef.current, TEXT_DEFAULT_DURATION);
        const clip = newTextClip({ id, trackId: track.id, start, duration: TEXT_DEFAULT_DURATION });
        return { ...next, clips: [...next.clips, clip] };
      });
      selectClip(id);
    },
    [commit, selectClip],
  );

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
  /** Selected clips the playhead crosses, or every clip it crosses when none of the selection does. */
  const underPlayhead = useCallback((p: Project, t: number) => {
    const crosses = (c: Clip) => t > c.start + 0.01 && t < clipEnd(c) - 0.01;
    const sel = new Set(selectionRef.current);
    const picked = p.clips.filter((c) => sel.has(c.id) && crosses(c));
    return (picked.length ? picked : p.clips.filter(crosses)).map((c) => c.id);
  }, []);

  const splitAtPlayhead = useCallback(() => {
    const t = timeRef.current;
    commit((p) => splitClips(p, underPlayhead(p, t), t));
  }, [commit, underPlayhead]);

  const trimAtPlayhead = useCallback(
    (side: "start" | "end") => {
      const t = timeRef.current;
      commit((p) => trimToTime(p, underPlayhead(p, t), t, side));
    },
    [commit, underPlayhead],
  );

  const deleteSelected = useCallback(
    (ripple = false) => {
      const ids = selectionRef.current;
      if (!ids.length) return;
      commit((p) => (ripple ? rippleDelete(p, ids) : removeClips(p, withLinked(p, ids))));
      select([], null);
    },
    [commit, select],
  );

  const duplicateSelected = useCallback(() => {
    const p = projectRef.current;
    const clips = p.clips.filter((c) => withLinked(p, selectionRef.current).has(c.id));
    if (!clips.length) return;
    const end = Math.max(...clips.map(clipEnd));
    const placed = placeClips(p, clips, end);
    commit(() => placed.project);
    select(placed.ids, placed.ids[0] ?? null);
  }, [commit, select]);

  const copySelected = useCallback(() => {
    const p = projectRef.current;
    const ids = withLinked(p, selectionRef.current);
    clipboard.current = p.clips.filter((c) => ids.has(c.id)).map((c) => ({ ...c }));
  }, []);

  const paste = useCallback(
    (at?: number) => {
      if (!clipboard.current.length) return;
      const placed = placeClips(projectRef.current, clipboard.current, at ?? timeRef.current);
      commit(() => placed.project);
      select(placed.ids, placed.ids[0] ?? null);
    },
    [commit, select],
  );

  const setLinked = useCallback(
    (linked: boolean) => commit((p) => setLink(p, selectionRef.current, linked)),
    [commit],
  );

  const toggleMarker = useCallback(
    (at?: number) => {
      const t = at ?? timeRef.current;
      commit((p) => {
        const near = p.markers.find((m) => Math.abs(m.time - t) <= 0.5 / p.fps);
        return near
          ? { ...p, markers: p.markers.filter((m) => m !== near) }
          : { ...p, markers: [...p.markers, { id: uid("k"), time: t }].sort((a, b) => a.time - b.time) };
      });
    },
    [commit],
  );

  /** Jump to the previous or next clip edge or marker. */
  const jumpEdit = useCallback(
    (dir: 1 | -1) => {
      const p = projectRef.current;
      const t = timeRef.current;
      const points = [0, ...p.markers.map((m) => m.time), ...p.clips.flatMap((c) => [c.start, clipEnd(c)])];
      const next =
        dir > 0
          ? Math.min(...points.filter((x) => x > t + 1e-3), Number.POSITIVE_INFINITY)
          : Math.max(...points.filter((x) => x < t - 1e-3), Number.NEGATIVE_INFINITY);
      if (Number.isFinite(next)) seek(next);
    },
    [seek],
  );

  const patchSelected = useCallback(
    (patch: Partial<MediaClip> | Partial<TextClip>) => {
      const id = primaryRef.current;
      if (id) commit((p) => updateClip(p, id, patch));
    },
    [commit],
  );

  /** Continuous edits (sliders, drags) record one history step per interaction. */
  const liveMap = useCallback(
    (fn: (c: Clip) => Clip) => {
      const id = primaryRef.current;
      if (!id) return;
      if (!gestureBase.current) gesture.begin();
      gesture.live(mapClip(projectRef.current, id, fn));
    },
    [gesture],
  );
  const livePatch = useCallback(
    (patch: Partial<MediaClip> | Partial<TextClip>) => liveMap((c) => ({ ...c, ...patch }) as Clip),
    [liveMap],
  );

  /** Seconds into the primary clip at the playhead, where keyframes land. */
  const localTime = useCallback(() => {
    const c = projectRef.current.clips.find((x) => x.id === primaryRef.current);
    return c ? Math.min(Math.max(timeRef.current - c.start, 0), c.duration) : 0;
  }, []);

  const detachAudio = useCallback(() => {
    const clip = projectRef.current.clips.find((c) => c.id === primaryRef.current);
    if (!clip || clip.type !== "media") return;
    commit((p) => {
      let tracks = p.tracks;
      let target = tracks.find(
        (t) => t.kind === "audio" && findFreeStart(p, t.id, clip.start, clip.duration) === clip.start,
      );
      if (!target) {
        target = { id: uid("t"), kind: "audio", name: `Audio ${tracks.filter((t) => t.kind === "audio").length + 1}`, muted: false, hidden: false };
        tracks = [...tracks, target];
      }
      const linkId = clip.linkId ?? uid("l");
      const audio = newMediaClip({
        id: uid("c"),
        trackId: target.id,
        mediaId: clip.mediaId,
        start: clip.start,
        duration: clip.duration,
        in: clip.in,
        speed: clip.speed,
        volume: clip.volume,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        duck: clip.duck,
        linkId,
      });
      return {
        ...p,
        tracks,
        clips: [...p.clips.map((c) => (c.id === clip.id ? { ...clip, volume: 0, duck: false, linkId } : c)), audio],
      };
    });
  }, [commit]);

  const normalize = useCallback(async () => {
    const clip = projectRef.current.clips.find((c) => c.id === primaryRef.current);
    const item = clip?.type === "media" ? mediaRef.current.get(clip.mediaId) : undefined;
    if (!clip || clip.type !== "media" || !item) return;
    setBusy("Measuring loudness…");
    try {
      const peak = await clipPeak(clip, item);
      if (peak <= 0) setError("This clip is silent, so there's nothing to normalize.");
      else commit((p) => updateClip(p, clip.id, { volume: Math.min(MAX_VOLUME, 0.89 / peak) }));
    } finally {
      setBusy(null);
    }
  }, [commit]);

  const reverseClip = useCallback(async () => {
    const clip = projectRef.current.clips.find((c) => c.id === primaryRef.current);
    const item = clip?.type === "media" ? mediaRef.current.get(clip.mediaId) : undefined;
    if (!clip || clip.type !== "media" || !item || item.kind !== "video") return;
    engineRef.current?.pause();
    setBusy("Reversing… 0%");
    try {
      const from = clip.in;
      const to = Math.min(item.duration, clip.in + clip.duration * clip.speed);
      const file = await reverseRange(item, from, to, { onProgress: (f) => setBusy(`Reversing… ${Math.round(f * 100)}%`) });
      const reversed = await importOne(file);
      if (!reversed) return;
      // The picture and any separated sound from the same source flip together.
      commit((p) => {
        const group = new Set([clip.id, ...partners(p, clip).filter((c) => c.type === "media" && c.mediaId === item.id).map((c) => c.id)]);
        return { ...p, clips: p.clips.map((c) => (group.has(c.id) && c.type === "media" ? { ...c, mediaId: reversed.id, in: 0 } : c)) };
      });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't reverse this clip."));
    } finally {
      setBusy(null);
    }
  }, [commit, importOne]);

  const freezeFrame = useCallback(async () => {
    const t = timeRef.current;
    const clip = projectRef.current.clips.find((c) => c.id === primaryRef.current);
    const item = clip?.type === "media" ? mediaRef.current.get(clip.mediaId) : undefined;
    if (!clip || clip.type !== "media" || !item || item.kind !== "video" || t < clip.start || t >= clipEnd(clip)) return;
    engineRef.current?.pause();
    setBusy("Grabbing the frame…");
    try {
      const image = await importOne(await captureFrame(item, sourceTime(clip, t)));
      if (!image) return;
      const id = uid("c");
      commit((p) => {
        const c = p.clips.find((x) => x.id === clip.id);
        if (!c || c.type !== "media") return p;
        const tracks = new Set([c.trackId, ...partners(p, c).map((x) => x.trackId)]);
        let next = splitClips(p, [c.id], t);
        next = rippleShift(next, tracks, t, FREEZE_LENGTH);
        // Whatever room the ripple managed is how long the hold lasts.
        const later = next.clips.filter((x) => x.trackId === c.trackId && x.start > t + 1e-3).map((x) => x.start);
        const room = Math.min(FREEZE_LENGTH, ...later.map((s) => s - t));
        if (room < 0.1) return p;
        const pose = poseAt(c, t - c.start);
        const still = newMediaClip({
          id,
          trackId: c.trackId,
          mediaId: image.id,
          start: t,
          duration: room,
          ...pose,
          crop: c.crop,
          color: c.color,
          flipH: c.flipH,
          flipV: c.flipV,
        });
        return { ...next, clips: [...next.clips, still] };
      });
      selectClip(id);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't freeze that frame."));
    } finally {
      setBusy(null);
    }
  }, [commit, importOne, selectClip]);

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
    (trackId: string) =>
      commit((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== trackId), clips: p.clips.filter((c) => c.trackId !== trackId) })),
    [commit],
  );
  const renameTrack = useCallback(
    (trackId: string, name: string) => commit((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)) })),
    [commit],
  );
  /** Swap a track with its neighbour of the same kind. */
  const moveTrack = useCallback(
    (trackId: string, dir: -1 | 1) =>
      commit((p) => {
        const i = p.tracks.findIndex((t) => t.id === trackId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= p.tracks.length || p.tracks[j].kind !== p.tracks[i].kind) return p;
        const tracks = [...p.tracks];
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        return { ...p, tracks };
      }),
    [commit],
  );

  const addCaptions = useCallback(
    (cues: Cue[]) => {
      commit((p) => {
        const track: Track = { id: uid("t"), kind: "text", name: "Captions", muted: false, hidden: false };
        const clips = cues.map((cue, i) => {
          const next = cues[i + 1];
          const end = Math.max(cue.start + 0.3, next ? Math.min(cue.end, next.start) : cue.end);
          return newTextClip({
            id: uid("c"),
            trackId: track.id,
            start: cue.start,
            duration: end - cue.start,
            text: cue.text,
            size: 58,
            bold: true,
            outline: "#1a1612",
            y: 0.86,
          });
        });
        return { ...p, tracks: [track, ...p.tracks], clips: [...p.clips, ...clips] };
      });
    },
    [commit],
  );

  const saveFrame = useCallback(() => {
    const canvas = engineRef.current?.snapshot();
    if (!canvas) return;
    const t = timeRef.current;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `frame-${fmtTime(t, projectRef.current.fps).replaceAll(":", "-")}.png`, "image/png");
    }, "image/png");
  }, []);

  // ── Preview canvas: select, move, resize, rotate ───────────
  const toFrame = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const p = projectRef.current;
    return { x: ((clientX - rect.left) / rect.width) * p.width, y: ((clientY - rect.top) / rect.height) * p.height };
  }, []);

  /** What the pointer is over on the canvas: a handle of the primary clip, a clip, or nothing. */
  const canvasTarget = useCallback((x: number, y: number) => {
    const engine = engineRef.current;
    if (!engine) return null;
    const p = projectRef.current;
    const u = engine.unit();
    const primary = p.clips.find((c) => c.id === primaryRef.current);
    if (primary && engine.onScreen(primary)) {
      const g = engine.geometry(primary);
      if (g) {
        const [, knob] = rotateHandle(g, u, p.width, p.height);
        if (Math.hypot(x - knob[0], y - knob[1]) <= HANDLE_HIT * u) return { kind: "rotate" as const, clip: primary, g };
        const corner = geometryCorners(g).findIndex(([cx, cy]) => Math.hypot(x - cx, y - cy) <= HANDLE_HIT * u);
        if (corner >= 0) return { kind: "corner" as const, clip: primary, g, corner };
      }
    }
    const hit = engine.hitTest(x, y);
    const clip = hit ? p.clips.find((c) => c.id === hit) : undefined;
    return clip ? { kind: "body" as const, clip } : null;
  }, []);

  const onCanvasDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const engine = engineRef.current;
      if (!engine || e.button !== 0 || (e.target as HTMLElement).closest("textarea")) return;
      canvasRef.current?.focus();
      const pt = toFrame(e.clientX, e.clientY);
      const target = canvasTarget(pt.x, pt.y);
      if (!target) {
        if (!e.shiftKey) select([], null);
        return;
      }
      const { clip } = target;
      if (target.kind === "body") {
        if (e.shiftKey) {
          const next = new Set(selectionRef.current);
          const own = withLinked(projectRef.current, [clip.id]);
          const adding = !next.has(clip.id);
          for (const id of own) adding ? next.add(id) : next.delete(id);
          select(next, adding ? clip.id : null);
          return;
        }
        if (clip.id !== primaryRef.current) selectClip(clip.id);
      }

      const base = gesture.begin();
      const orig = base.clips.find((c) => c.id === clip.id)!;
      const p = base;
      const local = Math.min(Math.max(timeRef.current - orig.start, 0), orig.duration);
      const pose0 = poseAt(orig, local);
      const W = p.width;
      const H = p.height;
      const u = engine.unit();
      const g0 = engine.geometry(orig);
      const tolerance = 0.5 / p.fps;
      const set = (patch: Partial<Pose>, extra?: Partial<TextClip>) =>
        gesture.live(mapClip(base, orig.id, (c) => ({ ...applyPose(c, patch, local, tolerance), ...extra }) as Clip));

      let move: (ev: PointerEvent) => void;
      if (target.kind === "rotate") {
        const a0 = Math.atan2(pt.y - pose0.y * H, pt.x - pose0.x * W);
        move = (ev) => {
          const q = toFrame(ev.clientX, ev.clientY);
          let r = pose0.rotation + ((Math.atan2(q.y - pose0.y * H, q.x - pose0.x * W) - a0) * 180) / Math.PI;
          r = ((((r + 180) % 360) + 360) % 360) - 180;
          if (ev.shiftKey) r = Math.round(r / 15) * 15;
          else if (Math.abs(r - Math.round(r / 90) * 90) < 3) r = Math.round(r / 90) * 90;
          set({ rotation: r });
        };
      } else if (target.kind === "corner" && g0) {
        const corners = geometryCorners(g0);
        const start = corners[target.corner];
        const opposite = corners[(target.corner + 2) % 4];
        const centre = { x: pose0.x * W, y: pose0.y * H };
        move = (ev) => {
          const q = toFrame(ev.clientX, ev.clientY);
          // ⌥ or ⇧ scales around the centre; otherwise the opposite corner stays put.
          const fromCentre = ev.altKey || ev.shiftKey;
          const anchor = fromCentre ? centre : { x: opposite[0], y: opposite[1] };
          const d0 = Math.hypot(start[0] - anchor.x, start[1] - anchor.y) || 1;
          const s = Math.max(0.02, Math.hypot(q.x - anchor.x, q.y - anchor.y) / d0);
          const cx = anchor.x + (centre.x - anchor.x) * s;
          const cy = anchor.y + (centre.y - anchor.y) * s;
          if (orig.type === "text") set({ x: cx / W, y: cy / H }, { size: Math.min(600, Math.max(8, Math.round(orig.size * s))) });
          else set({ scale: Math.min(10, Math.max(0.02, pose0.scale * s)), x: cx / W, y: cy / H });
        };
      } else {
        // Snap the clip's centre to the frame's centre, and its edges to the frame's edges.
        const box = g0 ? geometryCorners(g0) : null;
        const minX = box ? Math.min(...box.map((c) => c[0])) : 0;
        const maxX = box ? Math.max(...box.map((c) => c[0])) : 0;
        const minY = box ? Math.min(...box.map((c) => c[1])) : 0;
        const maxY = box ? Math.max(...box.map((c) => c[1])) : 0;
        const threshold = SNAP_SCREEN_PX * u;
        const snapAxis = (d: number, centre: number, lo: number, hi: number, size: number, axis: "x" | "y", guides: Guide[]) => {
          if (!box) return d;
          const options = [
            { delta: size / 2 - (centre + d), at: size / 2 },
            { delta: -(lo + d), at: 0 },
            { delta: size - (hi + d), at: size },
          ];
          const best = options.reduce((a, b) => (Math.abs(b.delta) < Math.abs(a.delta) ? b : a));
          if (Math.abs(best.delta) > threshold) return d;
          guides.push({ axis, at: best.at });
          return d + best.delta;
        };
        move = (ev) => {
          const q = toFrame(ev.clientX, ev.clientY);
          const guides: Guide[] = [];
          let dx = q.x - pt.x;
          let dy = q.y - pt.y;
          if (!(ev.metaKey || ev.ctrlKey)) {
            dx = snapAxis(dx, pose0.x * W, minX, maxX, W, "x", guides);
            dy = snapAxis(dy, pose0.y * H, minY, maxY, H, "y", guides);
          }
          setGuides(guides);
          set({
            x: Math.min(1.5, Math.max(-0.5, pose0.x + dx / W)),
            y: Math.min(1.5, Math.max(-0.5, pose0.y + dy / H)),
          });
        };
      }
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setGuides([]);
        gesture.end();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [canvasTarget, gesture, select, selectClip, toFrame],
  );

  const onCanvasHover = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.buttons || (e.target as HTMLElement).closest("textarea")) return;
      const pt = toFrame(e.clientX, e.clientY);
      const target = canvasTarget(pt.x, pt.y);
      e.currentTarget.style.cursor = !target
        ? "default"
        : target.kind === "rotate"
          ? "grab"
          : target.kind === "corner"
            ? target.corner % 2 === 0
              ? "nwse-resize"
              : "nesw-resize"
            : "move";
    },
    [canvasTarget, toFrame],
  );

  const onCanvasDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("textarea")) return;
      const pt = toFrame(e.clientX, e.clientY);
      const hit = engineRef.current?.hitTest(pt.x, pt.y);
      const clip = hit ? projectRef.current.clips.find((c) => c.id === hit) : undefined;
      if (clip?.type !== "text") return;
      engineRef.current?.pause();
      selectClip(clip.id);
      setEditingText(clip.id);
    },
    [selectClip, toFrame],
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
      const out = await exportProject(projectRef.current, mediaRef.current, settings, {
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
  }, []);

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

  // ── Context menus ──────────────────────────────────────────
  const openMenu = useCallback(
    (target: TimelineTarget, x: number, y: number) => {
      const p = projectRef.current;
      const t = timeRef.current;
      let items: MenuItem[] = [];
      if (target.kind === "clip") {
        const clip = p.clips.find((c) => c.id === target.clipId);
        if (!clip) return;
        const item = clip.type === "media" ? mediaRef.current.get(clip.mediaId) : undefined;
        const track = p.tracks.find((tr) => tr.id === clip.trackId);
        const crosses = t > clip.start + 0.01 && t < clipEnd(clip) - 0.01;
        const sel = selectionRef.current.length ? selectionRef.current : [clip.id];
        const multi = groupCount(p, sel) > 1;
        const isVideo = clip.type === "media" && item?.kind === "video" && track?.kind !== "audio";
        items = [
          { label: "Split at playhead", shortcut: "S", onSelect: splitAtPlayhead, disabled: !crosses },
          { label: "Trim start to playhead", shortcut: "Q", onSelect: () => trimAtPlayhead("start"), disabled: !crosses },
          { label: "Trim end to playhead", shortcut: "W", onSelect: () => trimAtPlayhead("end"), disabled: !crosses },
          "sep",
          { label: "Copy", shortcut: "⌘C", onSelect: copySelected },
          { label: "Duplicate", shortcut: "⌘D", onSelect: duplicateSelected },
          "sep",
        ];
        if (multi) items.push({ label: "Link together", onSelect: () => setLinked(true) });
        if (clip.linkId) items.push({ label: "Unlink", onSelect: () => setLinked(false) });
        if (isVideo && item?.hasAudio && clip.type === "media" && clip.volume > 0 && !multi) {
          items.push({ label: "Separate audio", onSelect: detachAudio });
        }
        if (isVideo && !multi) {
          items.push({ label: "Reverse", onSelect: reverseClip, disabled: !!busy });
          items.push({ label: "Freeze frame at playhead", onSelect: freezeFrame, disabled: !crosses || !!busy });
        }
        if (items[items.length - 1] !== "sep") items.push("sep");
        items.push(
          { label: "Delete", shortcut: "⌫", onSelect: () => deleteSelected(false), danger: true },
          { label: "Ripple delete", shortcut: "⇧⌫", onSelect: () => deleteSelected(true), danger: true },
        );
      } else if (target.kind === "lane") {
        const gap = gapAt(p, target.trackId, target.time);
        const track = p.tracks.find((tr) => tr.id === target.trackId);
        items = [
          { label: "Paste here", shortcut: "⌘V", onSelect: () => paste(target.time), disabled: !clipboard.current.length },
          { label: "Close gap", onSelect: () => commit((q) => closeGap(q, target.trackId, target.time)), disabled: !gap || gap.to - gap.from < 0.01 },
          { label: "Add marker here", shortcut: "M", onSelect: () => toggleMarker(target.time) },
        ];
        if (track?.kind === "text") items.push({ label: "Add text here", shortcut: "T", onSelect: () => addText(target.time) });
      } else if (target.kind === "track") {
        const track = p.tracks.find((tr) => tr.id === target.trackId);
        if (!track) return;
        const i = p.tracks.indexOf(track);
        const count = p.clips.filter((c) => c.trackId === track.id).length;
        items = [
          { label: "Move up", onSelect: () => moveTrack(track.id, -1), disabled: p.tracks[i - 1]?.kind !== track.kind },
          { label: "Move down", onSelect: () => moveTrack(track.id, 1), disabled: p.tracks[i + 1]?.kind !== track.kind },
          { label: track.kind === "audio" ? "New audio track" : track.kind === "video" ? "New video track" : "New text track", onSelect: () => addTrack(track.kind) },
          "sep",
          { label: count ? `Delete track and its ${count} clip${count === 1 ? "" : "s"}` : "Delete track", onSelect: () => removeTrack(track.id), danger: true },
        ];
      } else {
        items = [
          { label: "Remove marker", onSelect: () => commit((q) => ({ ...q, markers: q.markers.filter((m) => m.id !== target.markerId) })), danger: true },
          { label: "Remove all markers", onSelect: () => commit((q) => ({ ...q, markers: [] })), danger: true },
        ];
      }
      setMenu({ x, y, items });
    },
    [addText, addTrack, busy, commit, copySelected, deleteSelected, detachAudio, duplicateSelected, freezeFrame, moveTrack, paste, removeTrack, reverseClip, setLinked, splitAtPlayhead, toggleMarker, trimAtPlayhead],
  );
  const closeMenu = useCallback(() => setMenu(null), []);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    if (!hasMedia || result || exportOpen || captionsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const p = projectRef.current;
      const fps = p.fps;
      // With the preview focused, arrows nudge the selected clip instead of moving the playhead.
      const nudging = document.activeElement === canvasRef.current && primaryRef.current && !mod;
      if (e.code === "Space") {
        e.preventDefault();
        // Space stops a bin preview first, then drives the timeline.
        if (binPlayingRef.current) stopBinPreview();
        else togglePlay();
      } else if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (mod && key === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && key === "c") {
        copySelected();
      } else if (mod && key === "v") {
        e.preventDefault();
        paste();
      } else if (mod && key === "a") {
        e.preventDefault();
        select(
          p.clips.map((c) => c.id),
          primaryRef.current,
        );
      } else if (mod) {
        return;
      } else if (key === "s") {
        e.preventDefault();
        splitAtPlayhead();
      } else if (key === "q") {
        trimAtPlayhead("start");
      } else if (key === "w") {
        trimAtPlayhead("end");
      } else if (key === "t") {
        e.preventDefault();
        addText();
      } else if (key === "m") {
        toggleMarker();
      } else if (key === "l") {
        shuttle(1);
      } else if (key === "j") {
        shuttle(-1);
      } else if (key === "k") {
        engineRef.current?.pause();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected(e.shiftKey);
      } else if (nudging && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const id = primaryRef.current!;
        const local = localTime();
        commit((q) =>
          mapClip(q, id, (c) => {
            const pose = poseAt(c, local);
            return applyPose(c, { x: pose.x + dx / q.width, y: pose.y + dy / q.height }, local, 0.5 / q.fps);
          }),
        );
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "," || e.key === ".") {
        e.preventDefault();
        const back = e.key === "ArrowLeft" || e.key === ",";
        const step = e.shiftKey ? 1 : 1 / fps;
        seek(timeRef.current + (back ? -step : step));
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        jumpEdit(e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        seek(0);
      } else if (e.key === "End") {
        e.preventDefault();
        seek(projectDuration(p));
      } else if (e.key === "Escape") {
        select([], null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasMedia, result, exportOpen, captionsOpen, togglePlay, undo, redo, duplicateSelected, copySelected, paste, select, splitAtPlayhead, trimAtPlayhead, addText, toggleMarker, shuttle, deleteSelected, commit, localTime, seek, jumpEdit, stopBinPreview]);

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
    select([], null);
    setResult(null);
    setTime(0);
    sizedFromMedia.current = false;
  }, [select, wipeDraft]);

  // ── Inspector wiring ───────────────────────────────────────
  const clipActions = useMemo((): ClipActions | null => {
    if (!selected) return null;
    const local = Math.min(Math.max(time - selected.start, 0), selected.duration);
    return {
      live: livePatch,
      commit: gesture.end,
      patch: patchSelected,
      pose: poseAt(selected, local),
      livePose: (patch) => liveMap((c) => applyPose(c, patch, localTime(), tol)),
      patchPose: (patch) => {
        const id = primaryRef.current;
        if (id) commit((p) => mapClip(p, id, (c) => applyPose(c, patch, localTime(), tol)));
      },
      keyframe: (prop: AnimProp) => ({
        on: keyframeIndex(selected, prop, local, tol) >= 0,
        animated: isAnimated(selected, prop),
        onToggle: () => commit((p) => mapClip(p, selected.id, (c) => toggleKeyframe(c, prop, localTime(), tol))),
      }),
    };
  }, [selected, time, tol, livePatch, gesture, patchSelected, liveMap, localTime, commit]);

  const selectedItem = selected?.type === "media" ? media.get(selected.mediaId) : undefined;
  const selectedTrack = selected ? project.tracks.find((t) => t.id === selected.trackId) : undefined;
  const mediaActions = useMemo((): MediaActions | null => {
    if (!clipActions || selected?.type !== "media") return null;
    const item = selectedItem;
    const fit = item?.width ? Math.min(project.width / item.width, project.height / item.height) : 1;
    const cover = item?.width ? Math.max(project.width / item.width, project.height / item.height) : 1;
    const visualVideo = item?.kind === "video" && selectedTrack?.kind !== "audio";
    const linkedAudio = partners(project, selected).some((c) => project.tracks.find((t) => t.id === c.trackId)?.kind === "audio");
    return {
      ...(clipActions as unknown as ClipActions<MediaClip>),
      setSpeed: (speed, live) => {
        const id = selected.id;
        if (live) {
          // Always from where the drag began, so clamping against a neighbour on the way never sticks.
          const base = gestureBase.current ?? gesture.begin();
          gesture.live(setSpeed(base, id, speed, mediaRef.current));
        } else commit((p) => setSpeed(p, id, speed, mediaRef.current));
      },
      fillScale: cover / fit,
      detachAudio: visualVideo && item?.hasAudio && selected.volume > 0 && !linkedAudio ? detachAudio : null,
      normalize,
      reverse: reverseClip,
      freeze: visualVideo && time >= selected.start && time < clipEnd(selected) ? freezeFrame : null,
      busy,
    };
  }, [clipActions, selected, selectedItem, selectedTrack, project, time, gesture, commit, detachAudio, normalize, reverseClip, freezeFrame, busy]);

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
            Arrange clips on video, audio and text tracks: trim, split, change speed, crop, colour, animate with keyframes,
            add transitions and auto captions, then export an MP4. Your edit autosaves on this device, so you can close the
            tab and pick up where you left off. Nothing is uploaded.
          </InfoBox>
        </div>
      </div>
    );
  }

  const panelTitle = "h-10 shrink-0 flex items-center justify-between gap-2 px-3 border-b-2 border-foreground bg-muted";
  const kicker = "text-[11px] font-bold uppercase tracking-[0.14em]";
  const editingClip = editingText ? project.clips.find((c): c is TextClip => c.id === editingText && c.type === "text") : undefined;

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
          onClick={() => select([], null)}
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
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasHover}
            onDoubleClick={onCanvasDoubleClick}
            style={{
              backgroundImage: "radial-gradient(color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          >
            <div ref={stageRef} className="w-full h-full flex items-center justify-center">
              <div className="relative" style={{ width: canvasW, height: canvasH }}>
                <canvas
                  ref={canvasRef}
                  tabIndex={0}
                  aria-label="Preview: drag clips to move, corners to resize, the knob to rotate"
                  className="block border-2 border-foreground bg-black shadow-[6px_6px_0_0_var(--foreground)] outline-none focus-visible:shadow-[6px_6px_0_0_var(--primary)]"
                  style={{ width: canvasW, height: canvasH }}
                />
                {engineRef.current && (
                  <SelectionOverlay
                    engine={engineRef.current}
                    project={project}
                    selection={selection}
                    primaryId={primaryId}
                    editingId={editingText}
                    guides={guides}
                    time={time}
                    cssScale={canvasW / project.width}
                  />
                )}
                {editingClip && engineRef.current && (
                  <InlineTextEditor
                    clip={editingClip}
                    engine={engineRef.current}
                    project={project}
                    cssScale={canvasW / project.width}
                    onLive={(text) => livePatch({ text })}
                    onDone={() => {
                      gesture.end();
                      setEditingText(null);
                    }}
                  />
                )}
              </div>
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
            {playing && rate !== 1 && (
              <span className="px-1.5 border-2 border-foreground bg-foreground text-background font-mono text-[11px] font-bold">
                {rate < 0 ? "◀ " : ""}
                {Math.abs(rate)}×
              </span>
            )}
            <div className="flex-1" />
            <IconButton onClick={saveFrame} title="Save this frame as a PNG">
              <CameraIcon className="w-4 h-4" />
            </IconButton>
          </div>
        </main>

        {/* Inspector */}
        <aside className="w-64 xl:w-72 shrink-0 flex flex-col border-l-2 border-foreground bg-card">
          <div className={panelTitle}>
            <span className={kicker}>
              {groups > 1 ? "Selection" : selected ? (selected.type === "text" ? "Text" : "Clip") : "Project"}
            </span>
            {selected && groups <= 1 && (
              <div className="flex items-center gap-1">
                <MiniButton onClick={splitAtPlayhead} title="Split at playhead (S)">
                  <VideoTrimIcon className="w-3.5 h-3.5" />
                </MiniButton>
                <MiniButton onClick={duplicateSelected} title="Duplicate (⌘D)">
                  <CopyIcon className="w-3.5 h-3.5" />
                </MiniButton>
                <MiniButton onClick={() => deleteSelected(false)} title="Delete (⌫)" danger>
                  <TrashIcon className="w-3.5 h-3.5" />
                </MiniButton>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto select-text">
            {groups > 1 ? (
              <MultiInspector
                count={selection.length}
                linked={selection.every((id) => project.clips.find((c) => c.id === id)?.linkId)}
                onDelete={() => deleteSelected(false)}
                onRippleDelete={() => deleteSelected(true)}
                onLink={() => setLinked(true)}
                onUnlink={() => setLinked(false)}
              />
            ) : selected?.type === "media" && mediaActions ? (
              <MediaInspector
                key={selected.id}
                clip={selected}
                item={selectedItem}
                trackKind={selectedTrack?.kind ?? "video"}
                actions={mediaActions}
              />
            ) : selected?.type === "text" && clipActions ? (
              <TextInspector key={selected.id} clip={selected} actions={clipActions as unknown as ClipActions<TextClip>} />
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
      <section
        ref={timelineWrapRef}
        className="shrink-0 flex flex-col bg-card"
        style={{ height: timelineH }}
        // Working on the timeline hands the arrow keys back to the playhead.
        onPointerDownCapture={() => canvasRef.current?.blur()}
      >
        <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b-2 border-foreground">
          <ToolButton onClick={splitAtPlayhead} title="Split at playhead (S)">
            <VideoTrimIcon className="w-3.5 h-3.5" /> Split
          </ToolButton>
          <ToolButton onClick={() => addText()} title="Add text (T)">
            <span className="font-display text-base leading-none">T</span> Text
          </ToolButton>
          <ToolButton
            onClick={() => {
              engineRef.current?.pause();
              setCaptionsOpen(true);
            }}
            disabled={duration <= 0}
            title="Transcribe the edit's audio into text clips, on this device"
          >
            <span className="font-mono text-[10px] leading-none border border-current px-0.5">CC</span> Captions
          </ToolButton>
          <ToolButton onClick={() => deleteSelected(false)} disabled={!selection.length} title="Delete selected (⌫)" danger>
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
            selection={selectedSet}
            primaryId={primaryId}
            gesture={gesture}
            onSeek={seek}
            onSelect={select}
            onToggleTrack={toggleTrack}
            onRemoveTrack={removeTrack}
            onRenameTrack={renameTrack}
            onDropMedia={addMediaToTimeline}
            onZoom={setPps}
            onMenu={openMenu}
          />
        </div>
      </section>

      {/* ── Overlays ── */}
      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}

      {error && (
        <div className="absolute left-4 bottom-4 z-30 max-w-md flex items-start gap-2 border-2 border-foreground bg-card p-3 shadow-[4px_4px_0_0_var(--foreground)]">
          <AlertIcon className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <p className="text-sm flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} title="Dismiss" className="shrink-0 hover:text-destructive">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {captionsOpen && (
        <CaptionsDialog
          getPcm={() => mixForCaptions(projectRef.current, mediaRef.current, projectDuration(projectRef.current))}
          onAdd={addCaptions}
          onClose={() => setCaptionsOpen(false)}
        />
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

/**
 * Selection outlines, transform handles and snap guides, drawn over the preview
 * and allowed past its edges so a full-frame clip's handles stay grabbable.
 */
function SelectionOverlay({
  engine,
  project,
  selection,
  primaryId,
  editingId,
  guides,
  time,
  cssScale,
}: {
  engine: PreviewEngine;
  project: Project;
  selection: string[];
  primaryId: string | null;
  editingId: string | null;
  guides: Guide[];
  time: number;
  cssScale: number;
}) {
  if (!cssScale) return null;
  // The engine's clock may run ahead of React's between frames; draw for the time React has.
  void time;
  const u = 1 / cssScale;
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${x},${y}`).join(" ");
  const shapes: React.ReactNode[] = [];
  for (const id of selection) {
    const clip = project.clips.find((c) => c.id === id);
    if (!clip || clip.id === editingId || !engine.onScreen(clip)) continue;
    const g = engine.geometry(clip);
    if (!g) continue;
    const corners = geometryCorners(g);
    const primary = clip.id === primaryId;
    shapes.push(
      <polygon
        key={`o-${id}`}
        points={pts(corners)}
        fill="none"
        stroke="#facc15"
        strokeWidth={2 * u}
        strokeDasharray={primary ? undefined : `${8 * u} ${6 * u}`}
      />,
    );
    if (!primary) continue;
    const [top, knob] = rotateHandle(g, u, project.width, project.height);
    shapes.push(
      <g key={`h-${id}`} stroke="#1a1612" strokeWidth={2 * u}>
        <line x1={top[0]} y1={top[1]} x2={knob[0]} y2={knob[1]} stroke="#facc15" />
        <circle cx={knob[0]} cy={knob[1]} r={6 * u} fill="#ffffff" />
        {corners.map(([x, y], i) => (
          <rect key={i} x={x - 5 * u} y={y - 5 * u} width={10 * u} height={10 * u} fill="#ffffff" />
        ))}
      </g>,
    );
  }
  for (const [i, g] of guides.entries()) {
    shapes.push(
      g.axis === "x" ? (
        <line key={`g-${i}`} x1={g.at} y1={0} x2={g.at} y2={project.height} stroke="#ec4899" strokeWidth={1.5 * u} strokeDasharray={`${6 * u} ${4 * u}`} />
      ) : (
        <line key={`g-${i}`} x1={0} y1={g.at} x2={project.width} y2={g.at} stroke="#ec4899" strokeWidth={1.5 * u} strokeDasharray={`${6 * u} ${4 * u}`} />
      ),
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-visible"
      width="100%"
      height="100%"
      viewBox={`0 0 ${project.width} ${project.height}`}
      preserveAspectRatio="none"
    >
      {shapes}
    </svg>
  );
}

/** Edit a text clip right where it sits on the preview. */
function InlineTextEditor({
  clip,
  engine,
  project,
  cssScale,
  onLive,
  onDone,
}: {
  clip: TextClip;
  engine: PreviewEngine;
  project: Project;
  cssScale: number;
  onLive: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  const g = engine.geometry(clip, Math.max(clip.start, Math.min(engine.time, clipEnd(clip) - 1e-3)));
  if (!g) return null;
  const pose = poseAt(clip, Math.min(Math.max(engine.time - clip.start, 0), clip.duration));
  const px = ((clip.size * project.height * pose.scale) / 1080) * cssScale;
  const w = Math.max(g.rect.w * cssScale, 120);
  const h = Math.max(g.rect.h * cssScale, px * 1.6);
  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={clip.text}
      onChange={(e) => onLive(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) e.currentTarget.blur();
      }}
      className="absolute resize-none overflow-hidden bg-transparent outline-2 outline-dashed outline-yellow-400 p-0 leading-[1.2]"
      style={{
        left: g.cx * cssScale - w / 2,
        top: g.cy * cssScale - h / 2,
        width: w,
        height: h,
        transform: pose.rotation ? `rotate(${pose.rotation}deg)` : undefined,
        font: `${clip.italic ? "italic " : ""}${clip.bold ? 700 : 400} ${px}px ${FONT_STACKS[clip.font]}`,
        color: clip.color,
        textAlign: clip.align,
        paddingTop: (h - px * 1.2 * clip.text.split("\n").length) / 2,
        caretColor: clip.color,
        textShadow: clip.outline ? `0 0 2px ${clip.outline}` : undefined,
      }}
    />
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
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
  ["Space / K", "Play / pause"],
  ["J / L", "Play backwards / forwards (again = faster)"],
  ["← →  , .", "Step one frame"],
  ["⇧← ⇧→", "Step one second"],
  ["↑ ↓", "Previous / next cut or marker"],
  ["S", "Split at playhead"],
  ["Q / W", "Trim start / end to playhead"],
  ["⌫ / ⇧⌫", "Delete / ripple delete"],
  ["⌘C ⌘V ⌘D", "Copy, paste, duplicate"],
  ["⌘A", "Select everything"],
  ["T / M", "Add text / marker"],
  ["⌘Z / ⇧⌘Z", "Undo / redo"],
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
      className="absolute right-0 top-11 z-40 w-80 border-2 border-foreground bg-card p-4 shadow-[5px_5px_0_0_var(--foreground)]"
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
        In the preview: drag to move, corners to resize (⌥ from the centre), the knob to rotate (⇧ snaps), arrows
        nudge once it's focused. ⇧-click or drag a box on the timeline to pick several; ⌥-click picks one of a linked
        pair. Right-click anything for more.
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


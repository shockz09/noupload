// Video editor autosave in IndexedDB, so closing the tab doesn't lose the edit.
//
// Media files are written once each, under their own key, when imported — they
// can be gigabytes and never change. The draft record holds only the project
// and media metadata (thumbnails, peaks), so the frequent debounced saves stay
// small.

import { clear, createStore, del, delMany, get, keys, set } from "idb-keyval";
import type { MediaItem, Project } from "./model";

const store = createStore("noupload-video-editor", "draft");
const DRAFT_KEY = "draft";
const FILE_PREFIX = "file:";
const fileKey = (id: string) => `${FILE_PREFIX}${id}`;

export type DraftMedia = Omit<MediaItem, "file" | "url">;

export interface VideoEditorDraft {
  version: 1;
  project: Project;
  media: DraftMedia[];
  time: number;
  pps: number;
  savedAt: number;
}

let persistAsked = false;

/** Ask the browser not to evict our storage under pressure. Best effort, once per session. */
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

export async function saveMediaFile(id: string, file: File) {
  requestPersistence();
  await set(fileKey(id), file, store);
}

export async function deleteMediaFile(id: string) {
  await del(fileKey(id), store);
}

/**
 * Write the draft record, then delete stored files nothing refers to any more.
 * `keepIds` covers media whose file write is still in flight, which the media
 * list may not show yet.
 */
export async function saveDraft(project: Project, items: MediaItem[], time: number, pps: number, keepIds: Iterable<string>) {
  const media: DraftMedia[] = items.map(({ file: _file, url: _url, ...rest }) => rest);
  const draft: VideoEditorDraft = { version: 1, project, media, time, pps, savedAt: Date.now() };
  await set(DRAFT_KEY, draft, store);

  // A file removed mid-write lands after its delete; sweep those up here.
  const keep = new Set([...items.map((m) => fileKey(m.id)), ...[...keepIds].map(fileKey)]);
  const stale = (await keys(store)).filter((k) => typeof k === "string" && k.startsWith(FILE_PREFIX) && !keep.has(k));
  if (stale.length) await delMany(stale, store);
}

/**
 * The saved draft's record, without reading any media files. With no usable
 * draft the store is emptied, so files orphaned by an interrupted session don't
 * sit on disk.
 */
export async function peekDraft(): Promise<VideoEditorDraft | null> {
  const d = await get<VideoEditorDraft>(DRAFT_KEY, store);
  if (d && d.version === 1 && (d.media.length > 0 || d.project.clips.length > 0)) return d;
  await clear(store);
  return null;
}

/** Load the draft with its media files. Media whose file went missing is dropped. */
export async function loadDraft(): Promise<{ draft: VideoEditorDraft; media: MediaItem[] } | null> {
  const draft = await peekDraft();
  if (!draft) return null;
  const media: MediaItem[] = [];
  for (const m of draft.media) {
    const file = await get<File>(fileKey(m.id), store);
    if (!file) continue;
    media.push({ ...m, file, url: URL.createObjectURL(file) });
  }
  return { draft, media };
}

export async function clearDraft() {
  await clear(store);
}

import { applyBufferChange, loadBufferItems } from "./idb";
import type { AddBufferItemInput, AddBufferResult, BufferItem } from "./types";
import { inferFileType, matchesFileAccept } from "./types";

const MAX_ITEMS = 5;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type Listener = () => void;
type Mutation = { type: "add"; item: BufferItem } | { type: "remove"; id: string } | { type: "clear" };

function applyMutation(items: BufferItem[], mutation: Mutation): BufferItem[] {
  if (mutation.type === "clear") return [];
  if (mutation.type === "remove") return items.filter((item) => item.id !== mutation.id);

  const next = [...items, mutation.item];
  while (next.length > MAX_ITEMS || next.reduce((sum, item) => sum + item.size, 0) > MAX_TOTAL_BYTES) {
    next.shift();
  }
  return next;
}

/**
 * Resolves after a paint, or after 200ms if none comes — rAF is throttled to a
 * standstill in a backgrounded tab, and a thumbnail must not hang on that.
 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 200);
    requestAnimationFrame(() => requestAnimationFrame(done));
  });
}

export class FileBufferStore {
  readonly ready: Promise<void>;
  private items: BufferItem[] = [];
  private error: string | null = null;
  private pendingItem: { id: string; path: string } | null = null;
  private snapshot = { items: this.items, error: this.error, pendingItem: this.pendingItem };
  private listeners = new Set<Listener>();
  private hydrating = typeof window !== "undefined";
  private startupMutations: Mutation[] = [];
  private writeQueue: Promise<void> = Promise.resolve();
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ready = this.hydrating ? this.loadFromIDB() : Promise.resolve();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getSnapshot() {
    return this.snapshot;
  }

  clearError(): void {
    if (!this.error) return;
    this.error = null;
    this.notify();
  }

  getItems(): BufferItem[] {
    this.purgeExpired();
    return [...this.items];
  }

  add(input: AddBufferItemInput): AddBufferResult {
    this.purgeExpired();
    if (input.blob.size > MAX_TOTAL_BYTES) {
      const error = "This file exceeds the 200 MB buffer limit. Download it instead.";
      this.reportError(error);
      return { ok: false, error };
    }

    const fileType = input.fileType ?? inferFileType(input.mimeType);
    const isImage = fileType === "image";

    const item: BufferItem = {
      ...input,
      size: input.blob.size,
      fileType,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      previewUrl: isImage ? URL.createObjectURL(input.blob) : undefined,
    };

    this.mutate({ type: "add", item });

    // Generate thumbnails async — PDFs render page 1, videos grab a frame
    if (fileType === "pdf") {
      this.generatePdfThumbnail(item).catch(() => {});
    } else if (fileType === "video") {
      this.generateVideoThumbnail(item).catch(() => {});
    }

    return { ok: true };
  }

  remove(id: string): void {
    this.mutate({ type: "remove", id });
  }

  clear(): void {
    this.mutate({ type: "clear" });
  }

  toFile(item: BufferItem): File {
    return new File([item.blob], item.filename, { type: item.mimeType });
  }

  setPendingItem(id: string, path: string): void {
    this.pendingItem = { id, path };
    this.notify();
  }

  consumePendingItem(path: string, accept: string, maxSize: number): File | null {
    if (!this.pendingItem || this.pendingItem.path !== path) return null;
    const item = this.items.find((i) => i.id === this.pendingItem?.id);
    this.pendingItem = null;
    this.notify();
    return item && item.size <= maxSize && matchesFileAccept(item.filename, item.mimeType, accept)
      ? this.toFile(item)
      : null;
  }

  private async generatePdfThumbnail(item: BufferItem): Promise<void> {
    // Bail early if item was removed before we start
    if (!this.items.find((i) => i.id === item.id)) return;

    const { loadPdfjs } = await import("@/lib/pdfjs-config");
    const pdfjsLib = await loadPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: await item.blob.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);

    const thumbHeight = 80;
    const viewport = page.getViewport({ scale: 1 });
    const scale = thumbHeight / viewport.height;
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
    pdf.destroy();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) return;

    this.attachThumbnail(item.id, blob);
  }

  private async generateVideoThumbnail(item: BufferItem): Promise<void> {
    // Bail early if item was removed before we start
    if (!this.items.find((i) => i.id === item.id)) return;

    const objectUrl = URL.createObjectURL(item.blob);
    const video = document.createElement("video");

    try {
      video.muted = true;
      video.playsInline = true;
      // "auto", not "metadata" — WebKit never fires a frame-bearing event under
      // "metadata", so the seek below would wait forever.
      video.preload = "auto";
      video.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("thumbnail timeout")), 10_000);
        const done = (fn: () => void) => {
          clearTimeout(timer);
          fn();
        };
        const seek = () => {
          // First frame is often black — step slightly into the clip
          const target = Math.min(0.1, (video.duration || 1) / 10);
          if (video.currentTime !== target) video.currentTime = target;
        };
        // Whichever lands first wins; the second call is a no-op once seeked.
        video.onloadedmetadata = seek;
        video.onloadeddata = seek;
        video.onseeked = () => done(resolve);
        video.onerror = () => done(() => reject(new Error("video decode failed")));
      });

      // WebKit fires "seeked" before the frame is drawable — drawImage there
      // yields a blank canvas. Wait for decoded data, then a paint tick.
      const frameDeadline = Date.now() + 3_000;
      while (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && Date.now() < frameDeadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await nextPaint();

      const thumbHeight = 80;
      const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;

      const canvas = document.createElement("canvas");
      canvas.height = thumbHeight;
      canvas.width = Math.max(1, Math.round(thumbHeight * aspect));
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      canvas.width = 0;
      canvas.height = 0;

      if (!blob) return;

      this.attachThumbnail(item.id, blob);
    } finally {
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
      video.load();
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Attaches a generated thumbnail, unless the item was removed meanwhile
  private attachThumbnail(itemId: string, thumbnail: Blob): void {
    const url = URL.createObjectURL(thumbnail);
    const existing = this.items.find((i) => i.id === itemId);
    if (existing) {
      if (existing.previewUrl) URL.revokeObjectURL(existing.previewUrl);
      existing.previewUrl = url;
      this.items = [...this.items];
      this.notify();
    } else {
      URL.revokeObjectURL(url);
    }
  }

  private notify(): void {
    this.snapshot = { items: this.items, error: this.error, pendingItem: this.pendingItem };
    for (const fn of this.listeners) fn();
  }

  private reportError(message: string): void {
    this.error = message;
    this.notify();
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const item of [...this.items]) {
      if (now - item.createdAt >= TTL_MS) this.mutate({ type: "remove", id: item.id });
    }
  }

  private scheduleExpiry(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const next = Math.min(...this.items.map((item) => item.createdAt + TTL_MS));
    if (Number.isFinite(next)) {
      this.expiryTimer = setTimeout(() => this.purgeExpired(), Math.max(0, next - Date.now()));
    }
  }

  private mutate(mutation: Mutation): void {
    const previous = this.items;
    const next = applyMutation(previous, mutation);
    const kept = new Set(next.map((item) => item.id));
    const removed = previous.filter((item) => !kept.has(item.id));
    for (const item of removed) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    this.items = next;
    this.scheduleExpiry();
    this.notify();

    if (this.hydrating) {
      this.startupMutations.push(mutation);
      return;
    }

    const added = mutation.type === "add" ? [mutation.item] : [];
    this.queueWrite(() =>
      applyBufferChange(
        added,
        removed.map((item) => item.id),
        mutation.type === "clear",
      ),
    );
  }

  private queueWrite(write: () => Promise<void>): void {
    this.writeQueue = this.writeQueue.then(write).catch((error) => {
      console.error("File buffer could not be saved:", error);
      this.reportError("The file is available in this tab, but the browser could not save it for later.");
    });
  }

  private async loadFromIDB(): Promise<void> {
    let loaded: BufferItem[] = [];
    let loadSucceeded = false;
    try {
      loaded = await loadBufferItems();
      loadSucceeded = true;
    } catch (error) {
      console.error("File buffer could not be loaded:", error);
      this.reportError("Saved files could not be loaded from this browser.");
    }

    if (loadSucceeded) {
      const now = Date.now();
      let next = loaded.filter((item) => now - item.createdAt < TTL_MS && item.size <= MAX_TOTAL_BYTES);
      const cleaned = next.length !== loaded.length;
      // Existing records are ordered by their creation time, not their IDB key.
      next.sort((a, b) => a.createdAt - b.createdAt);
      while (next.length > MAX_ITEMS || next.reduce((sum, item) => sum + item.size, 0) > MAX_TOTAL_BYTES) {
        next.shift();
      }
      for (const mutation of this.startupMutations) next = applyMutation(next, mutation);

      const kept = new Set(next.map((item) => item.id));
      for (const item of [...loaded, ...this.items]) {
        if (!kept.has(item.id) && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      this.items = next;
      this.scheduleExpiry();
      this.notify();

      if (cleaned || loaded.length !== next.length || this.startupMutations.length > 0) {
        const loadedIds = new Set(loaded.map((item) => item.id));
        const clear = this.startupMutations.some((mutation) => mutation.type === "clear");
        const added = clear ? next : next.filter((item) => !loadedIds.has(item.id));
        const removedIds = loaded.filter((item) => !kept.has(item.id)).map((item) => item.id);
        this.queueWrite(() => applyBufferChange(added, removedIds, clear));
      }

      // Object URLs do not survive page reloads.
      for (const item of next) {
        if (item.previewUrl) continue;
        if (item.fileType === "pdf") this.generatePdfThumbnail(item).catch(() => {});
        if (item.fileType === "video") this.generateVideoThumbnail(item).catch(() => {});
      }
    }
    this.startupMutations = [];
    this.hydrating = false;
  }
}

export const fileBufferStore = new FileBufferStore();

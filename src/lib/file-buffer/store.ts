import { loadBufferItems, persistBufferItems } from "./idb";
import type { AddBufferItemInput, AddBufferResult, BufferItem } from "./types";
import { inferFileType } from "./types";

const MAX_ITEMS = 5;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type Listener = (items: BufferItem[]) => void;

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

class FileBufferStore {
  private items: BufferItem[] = [];
  private listeners = new Set<Listener>();
  private loaded = false;
  private pendingItemId: string | null = null;

  constructor() {
    // Hydrate from IndexedDB on creation (fire-and-forget)
    if (typeof window !== "undefined") {
      this.loadFromIDB();
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getItems(): BufferItem[] {
    this.purgeExpired();
    return [...this.items];
  }

  add(input: AddBufferItemInput): AddBufferResult {
    this.purgeExpired();

    // Evict oldest items to make room
    while (this.items.length >= MAX_ITEMS) {
      const oldest = this.items.shift();
      if (oldest?.previewUrl) URL.revokeObjectURL(oldest.previewUrl);
    }

    // Evict oldest if size limit would be exceeded
    let totalBytes = this.items.reduce((sum, i) => sum + i.size, 0);
    while (this.items.length > 0 && totalBytes + input.size > MAX_TOTAL_BYTES) {
      const oldest = this.items.shift();
      if (oldest) {
        if (oldest.previewUrl) URL.revokeObjectURL(oldest.previewUrl);
        totalBytes -= oldest.size;
      }
    }

    const fileType = input.fileType ?? inferFileType(input.mimeType);
    const isImage = fileType === "image";

    const item: BufferItem = {
      ...input,
      fileType,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      previewUrl: isImage ? URL.createObjectURL(input.blob) : undefined,
    };

    this.items.push(item);
    this.notify();
    this.persistToIDB();

    // Generate thumbnails async — PDFs render page 1, videos grab a frame
    if (fileType === "pdf") {
      this.generatePdfThumbnail(item).catch(() => {});
    } else if (fileType === "video") {
      this.generateVideoThumbnail(item).catch(() => {});
    }

    return { ok: true };
  }

  remove(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.items = this.items.filter((i) => i.id !== id);
    this.notify();
    this.persistToIDB();
  }

  clear(): void {
    for (const item of this.items) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    this.items = [];
    this.notify();
    this.persistToIDB();
  }

  toFile(item: BufferItem): File {
    return new File([item.blob], item.filename, { type: item.mimeType });
  }

  setPendingItem(id: string): void {
    this.pendingItemId = id;
  }

  consumePendingItem(): File | null {
    if (!this.pendingItemId) return null;
    const item = this.items.find((i) => i.id === this.pendingItemId);
    this.pendingItemId = null;
    return item ? this.toFile(item) : null;
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
      this.notify();
    } else {
      URL.revokeObjectURL(url);
    }
  }

  private notify(): void {
    const snapshot = this.getItems();
    for (const fn of this.listeners) {
      fn(snapshot);
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    const before = this.items.length;
    this.items = this.items.filter((item) => {
      const expired = now - item.createdAt > TTL_MS;
      if (expired && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return !expired;
    });
    // Only persist if something was purged
    if (this.items.length !== before) {
      this.persistToIDB();
    }
  }

  private persistToIDB(): void {
    persistBufferItems(this.items).catch(() => {
      // IDB persistence is best-effort
    });
  }

  private async loadFromIDB(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const items = await loadBufferItems();
      if (items.length > 0) {
        this.items = items;
        this.purgeExpired();
        this.notify();

        // Regenerate thumbnails (blob URLs don't survive page reloads)
        for (const item of this.items) {
          if (item.previewUrl) continue;
          if (item.fileType === "pdf") {
            this.generatePdfThumbnail(item).catch(() => {});
          } else if (item.fileType === "video") {
            this.generateVideoThumbnail(item).catch(() => {});
          }
        }
      }
    } catch {
      // IDB load failure is non-fatal
    }
  }
}

export const fileBufferStore = new FileBufferStore();

import { loadBufferItems, persistBufferItems } from "./idb";
import type { AddBufferItemInput, AddBufferResult, BufferItem } from "./types";

const MAX_ITEMS = 5;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type Listener = (items: BufferItem[]) => void;

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

    const isImage = input.mimeType.startsWith("image/");
    const isPdf = input.mimeType === "application/pdf";

    const item: BufferItem = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      previewUrl: isImage ? URL.createObjectURL(input.blob) : undefined,
    };

    this.items.push(item);
    this.notify();
    this.persistToIDB();

    // Generate PDF thumbnail async — renders page 1 at thumbnail size
    if (isPdf) {
      this.generatePdfThumbnail(item).catch(() => {});
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

    const url = URL.createObjectURL(blob);
    const existing = this.items.find((i) => i.id === item.id);
    if (existing) {
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

        // Regenerate PDF thumbnails (blob URLs don't survive page reloads)
        for (const item of this.items) {
          if (item.mimeType === "application/pdf" && !item.previewUrl) {
            this.generatePdfThumbnail(item).catch(() => {});
          }
        }
      }
    } catch {
      // IDB load failure is non-fatal
    }
  }
}

export const fileBufferStore = new FileBufferStore();

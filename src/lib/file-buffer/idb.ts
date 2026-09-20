import { del, get } from "idb-keyval";
import type { BufferItem } from "./types";
import { inferFileType } from "./types";

const DB_NAME = "noupload-file-buffer";
const STORE_NAME = "items";
const META_STORE = "meta";
const LEGACY_KEY = "file-buffer-v1";

type StoredItem = Omit<BufferItem, "previewUrl">;

interface LegacyItem extends Omit<StoredItem, "blob"> {
  arrayBuffer: ArrayBuffer;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(META_STORE)) {
        request.result.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Another tab is blocking file buffer storage"));
    };
  });
  databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
}

function withoutPreview(item: BufferItem | StoredItem): StoredItem {
  const { previewUrl: _previewUrl, ...stored } = item as BufferItem;
  return stored;
}

function transact(mode: IDBTransactionMode, action: (store: IDBObjectStore) => void): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error("File buffer transaction aborted"));
        transaction.onerror = () => reject(transaction.error ?? new Error("File buffer transaction failed"));
        action(transaction.objectStore(STORE_NAME));
      }),
  );
}

function migrationComplete(db: IDBDatabase): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(META_STORE, "readonly").objectStore(META_STORE).get(LEGACY_KEY);
    request.onsuccess = () => resolve(request.result === true);
    request.onerror = () => reject(request.error);
  });
}

/** The marker and imported files commit together, so a failed cleanup cannot restore old files later. */
function finishMigration(db: IDBDatabase, items: StoredItem[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, META_STORE], "readwrite");
    for (const item of items) transaction.objectStore(STORE_NAME).put(item);
    transaction.objectStore(META_STORE).put(true, LEGACY_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("File buffer migration aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("File buffer migration failed"));
  });
}

export async function loadBufferItems(): Promise<BufferItem[]> {
  const db = await openDatabase();
  const stored = await new Promise<StoredItem[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!(await migrationComplete(db))) {
    // The old format held every file as an ArrayBuffer under one idb-keyval key.
    let legacy: LegacyItem[] | undefined;
    let legacyReadSucceeded = false;
    try {
      legacy = await get<LegacyItem[]>(LEGACY_KEY);
      legacyReadSucceeded = true;
    } catch (error) {
      // The new store is usable even if the old idb-keyval database is blocked.
      if (stored.length === 0) throw error;
    }
    if (Array.isArray(legacy) && stored.length === 0) {
      const migrated = legacy.map(({ arrayBuffer, ...item }) => ({
        ...item,
        blob: new Blob([arrayBuffer], { type: item.mimeType }),
      }));
      await finishMigration(db, migrated);
      stored.push(...migrated);
    } else if (legacyReadSucceeded) {
      await finishMigration(db, []);
    }
    if (Array.isArray(legacy)) {
      // The marker makes cleanup optional for correctness.
      try {
        await del(LEGACY_KEY);
      } catch (error) {
        console.warn("Could not remove the old file buffer record:", error);
      }
    }
  }

  return stored.map((raw) => {
    const fileType = raw.fileType === "other" ? inferFileType(raw.mimeType) : raw.fileType;
    return { ...raw, fileType, previewUrl: fileType === "image" ? URL.createObjectURL(raw.blob) : undefined };
  });
}

/** Commit a change atomically without reading or rewriting the other blobs. */
export function applyBufferChange(added: BufferItem[], removedIds: string[], clear = false): Promise<void> {
  if (added.length === 0 && removedIds.length === 0 && !clear) return Promise.resolve();
  return transact("readwrite", (store) => {
    if (clear) store.clear();
    else for (const id of removedIds) store.delete(id);
    for (const item of added) store.put(withoutPreview(item));
  });
}

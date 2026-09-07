import { del, get, set } from "idb-keyval";
import type { BufferItem } from "./types";
import { inferFileType } from "./types";

const IDB_KEY = "file-buffer-v1";

interface SerializedItem {
  id: string;
  filename: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  size: number;
  fileType: BufferItem["fileType"];
  sourceToolLabel: string;
  createdAt: number;
}

export async function persistBufferItems(items: BufferItem[]): Promise<void> {
  if (items.length === 0) {
    await del(IDB_KEY);
    return;
  }

  const serialized: SerializedItem[] = await Promise.all(
    items.map(async (item) => ({
      id: item.id,
      filename: item.filename,
      arrayBuffer: await item.blob.arrayBuffer(),
      mimeType: item.mimeType,
      size: item.size,
      fileType: item.fileType,
      sourceToolLabel: item.sourceToolLabel,
      createdAt: item.createdAt,
    })),
  );

  await set(IDB_KEY, serialized);
}

export async function loadBufferItems(): Promise<BufferItem[]> {
  const serialized = await get<SerializedItem[]>(IDB_KEY);
  if (!serialized || !Array.isArray(serialized)) return [];

  return serialized.map((raw) => {
    const blob = new Blob([raw.arrayBuffer], { type: raw.mimeType });
    // Items persisted before video had its own category were stored as "other"
    const fileType = raw.fileType === "other" ? inferFileType(raw.mimeType) : raw.fileType;
    const isImage = fileType === "image";

    return {
      id: raw.id,
      filename: raw.filename,
      blob,
      mimeType: raw.mimeType,
      size: raw.size,
      fileType,
      sourceToolLabel: raw.sourceToolLabel,
      createdAt: raw.createdAt,
      previewUrl: isImage ? URL.createObjectURL(blob) : undefined,
    };
  });
}

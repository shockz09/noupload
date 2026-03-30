"use client";

import { useEffect, useState } from "react";

import { fileBufferStore, type BufferItem } from "@/lib/file-buffer";

export function useFileBuffer() {
  const [items, setItems] = useState<BufferItem[]>(() => fileBufferStore.getItems());

  useEffect(() => {
    return fileBufferStore.subscribe(setItems);
  }, []);

  return {
    items,
    add: fileBufferStore.add.bind(fileBufferStore),
    remove: fileBufferStore.remove.bind(fileBufferStore),
    clear: fileBufferStore.clear.bind(fileBufferStore),
    toFile: fileBufferStore.toFile.bind(fileBufferStore),
  };
}

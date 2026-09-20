import { useSyncExternalStore } from "react";
import { fileBufferStore } from "@/lib/file-buffer";

const subscribe = (listener: () => void) => fileBufferStore.subscribe(listener);
const getSnapshot = () => fileBufferStore.getSnapshot();

export function useFileBuffer() {
  const { items, error, pendingItem } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    items,
    error,
    pendingItem,
    clearError: fileBufferStore.clearError.bind(fileBufferStore),
    add: fileBufferStore.add.bind(fileBufferStore),
    remove: fileBufferStore.remove.bind(fileBufferStore),
    clear: fileBufferStore.clear.bind(fileBufferStore),
    toFile: fileBufferStore.toFile.bind(fileBufferStore),
    setPendingItem: fileBufferStore.setPendingItem.bind(fileBufferStore),
    consumePendingItem: fileBufferStore.consumePendingItem.bind(fileBufferStore),
  };
}

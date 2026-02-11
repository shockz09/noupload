"use client";

import { del, get, set } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";
import type { PageState } from "../page";

const DRAFT_KEY = "pdf-editor-draft";
const SAVE_DEBOUNCE = 500; // Save 500ms after last change

export interface EditorDraft {
  fileData: ArrayBuffer;
  fileName: string;
  pageStates: PageState[];
  pageObjects: [number, object[]][];
  currentPage: number;
  savedAt: number;
}

interface UseAutoSaveOptions {
  file: File | null;
  pageStates: PageState[];
  pageObjects: Map<number, object[]>;
  currentPage: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  draft: EditorDraft | null;
  hasDraft: boolean;
  clearDraft: () => Promise<void>;
  loadDraft: () => Promise<EditorDraft | null>;
}

export function useAutoSave({
  file,
  pageStates,
  pageObjects,
  currentPage,
  enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // Check for existing draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      try {
        const existingDraft = await get<EditorDraft>(DRAFT_KEY);
        if (existingDraft) {
          setDraft(existingDraft);
          setHasDraft(true);
        }
      } catch (err) {
        console.error("Failed to check for draft:", err);
      }
    };

    checkDraft();
  }, []);

  // Serialize pageObjects for dependency tracking
  const pageObjectsKey = JSON.stringify(Array.from(pageObjects.entries()));

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!enabled || !file) return;

    const saveDraft = async () => {
      try {
        const fileData = await file.arrayBuffer();
        const draftData: EditorDraft = {
          fileData,
          fileName: file.name,
          pageStates,
          pageObjects: Array.from(pageObjects.entries()),
          currentPage,
          savedAt: Date.now(),
        };

        await set(DRAFT_KEY, draftData);
      } catch (err) {
        console.error("Failed to save draft:", err);
      }
    };

    // Debounced save - triggers 500ms after last change
    const timeout = setTimeout(saveDraft, SAVE_DEBOUNCE);

    return () => clearTimeout(timeout);
  }, [enabled, file, pageStates, pageObjectsKey, currentPage]);

  const clearDraft = useCallback(async () => {
    try {
      await del(DRAFT_KEY);
      setDraft(null);
      setHasDraft(false);
    } catch (err) {
      console.error("Failed to clear draft:", err);
    }
  }, []);

  const loadDraft = useCallback(async (): Promise<EditorDraft | null> => {
    try {
      const existingDraft = await get<EditorDraft>(DRAFT_KEY);
      return existingDraft || null;
    } catch (err) {
      console.error("Failed to load draft:", err);
      return null;
    }
  }, []);

  return {
    draft,
    hasDraft,
    clearDraft,
    loadDraft,
  };
}

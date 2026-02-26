"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/error";
import { type ConverterStatus, getConverter } from "./converter";

export function useLibreOffice() {
  const [status, setStatus] = useState<ConverterStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const converter = getConverter();

    // Sync current status
    setStatus(converter.status);

    // Subscribe to status changes
    const unsubscribe = converter.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    // Start initialization if not already done
    if (converter.status !== "ready") {
      converter.init().catch((err) => {
        setError(getErrorMessage(err, "Failed to load LibreOffice engine"));
      });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const convert = useCallback(async (file: File) => {
    const converter = getConverter();

    if (!converter.isReady) {
      await converter.init();
    }

    return converter.convert(file);
  }, []);

  return {
    isReady: status === "ready",
    isLoading: status === "loading",
    status,
    error,
    convert,
  };
}

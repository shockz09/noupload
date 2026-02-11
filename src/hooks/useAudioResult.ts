"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AudioResult {
  blob: Blob;
  filename: string;
  url: string;
}

interface UseAudioResultReturn {
  result: AudioResult | null;
  setResult: (blob: Blob, filename: string) => void;
  clearResult: () => void;
  download: () => void;
}

/**
 * Hook for managing audio processing results with automatic URL lifecycle management.
 *
 * Usage:
 * ```tsx
 * const { result, setResult, clearResult, download } = useAudioResult();
 *
 * // After processing:
 * setResult(processedBlob, "output.wav");
 *
 * // In SuccessCard:
 * <SuccessCard onDownload={download} onStartOver={clearResult}>
 *   {result && <AudioPlayer src={result.url} />}
 * </SuccessCard>
 * ```
 */
export function useAudioResult(): UseAudioResultReturn {
  const [result, setResultState] = useState<AudioResult | null>(null);
  const urlRef = useRef<string | null>(null);

  // Cleanup URL on unmount or when result changes
  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  const setResult = useCallback((blob: Blob, filename: string) => {
    // Revoke previous URL if exists
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }

    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setResultState({ blob, filename, url });
  }, []);

  const clearResult = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setResultState(null);
  }, []);

  const download = useCallback(() => {
    if (!result) return;

    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  return { result, setResult, clearResult, download };
}

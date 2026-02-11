"use client";

import { useCallback, useState } from "react";
import { isVideoFile } from "@/lib/constants";
import { extractAudioFromVideo, getFFmpeg, isFFmpegLoaded } from "@/lib/ffmpeg-utils";

export type ExtractionState = "idle" | "loading-ffmpeg" | "extracting";

interface UseVideoToAudioReturn {
  extractionState: ExtractionState;
  extractionProgress: number;
  isExtracting: boolean;
  videoFilename: string | null;
  processFileSelection: (files: File[], onAudioReady: (audioFiles: File[]) => void) => Promise<void>;
}

/**
 * Hook for handling video file uploads in audio tools.
 * Automatically extracts audio from video files before processing.
 *
 * Usage:
 * ```tsx
 * const { processFileSelection, extractionState, extractionProgress, isExtracting } = useVideoToAudio();
 *
 * const handleAudioReady = useCallback((files: File[]) => {
 *   // Your existing file handling logic
 * }, []);
 *
 * const handleFileSelected = useCallback((files: File[]) => {
 *   processFileSelection(files, handleAudioReady);
 * }, [processFileSelection, handleAudioReady]);
 * ```
 */
export function useVideoToAudio(): UseVideoToAudioReturn {
  const [extractionState, setExtractionState] = useState<ExtractionState>("idle");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);

  const processFileSelection = useCallback(async (files: File[], onAudioReady: (audioFiles: File[]) => void) => {
    // Check if any files are videos
    const videoFiles = files.filter((f) => isVideoFile(f.name));
    const audioFiles = files.filter((f) => !isVideoFile(f.name));

    if (videoFiles.length === 0) {
      // No videos, just pass through
      onAudioReady(files);
      return;
    }

    try {
      // Load FFmpeg if not already loaded
      if (!isFFmpegLoaded()) {
        setExtractionState("loading-ffmpeg");
        await getFFmpeg();
      }

      setExtractionState("extracting");
      const extractedAudioFiles: File[] = [];

      // Extract audio from each video file
      for (let i = 0; i < videoFiles.length; i++) {
        const videoFile = videoFiles[i];
        setVideoFilename(videoFile.name);
        setExtractionProgress(0);

        const audioBlob = await extractAudioFromVideo(
          videoFile,
          "wav", // Extract as WAV for lossless processing
          192,
          (progress) => {
            // Combine progress: each file contributes equally
            const baseProgress = (i / videoFiles.length) * 100;
            const fileProgress = (progress * 100) / videoFiles.length;
            setExtractionProgress(Math.round(baseProgress + fileProgress));
          },
        );

        // Convert blob to File object
        const baseName = videoFile.name.split(".").slice(0, -1).join(".");
        const audioFile = new File([audioBlob], `${baseName}.wav`, {
          type: "audio/wav",
        });

        extractedAudioFiles.push(audioFile);
      }

      // Combine audio files with any original audio files
      const allAudioFiles = [...audioFiles, ...extractedAudioFiles];
      onAudioReady(allAudioFiles);
    } catch (error) {
      console.error("Failed to extract audio from video:", error);
      throw error;
    } finally {
      setExtractionState("idle");
      setExtractionProgress(0);
      setVideoFilename(null);
    }
  }, []);

  return {
    extractionState,
    extractionProgress,
    isExtracting: extractionState !== "idle",
    videoFilename,
    processFileSelection,
  };
}

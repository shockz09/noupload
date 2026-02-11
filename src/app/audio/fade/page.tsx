"use client";

import { useCallback, useMemo, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
  AudioFileInfo,
  AudioPageHeader,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { FadeIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useAudioResult, useFileProcessing, useObjectURL, useVideoToAudio } from "@/hooks";
import { applyFade, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getFileBaseName } from "@/lib/utils";

export default function FadeAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [fadeIn, setFadeIn] = useState(1);
  const [fadeOut, setFadeOut] = useState(1);
  const [usedFadeIn, setUsedFadeIn] = useState(1);
  const [usedFadeOut, setUsedFadeOut] = useState(1);

  // Use custom hooks
  const { url: audioUrl, setSource: setAudioSource, revoke: revokeAudio } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();

  const handleAudioReady = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();

        try {
          const info = await getAudioInfo(selectedFile);
          setDuration(info.duration);
          setAudioSource(selectedFile);
        } catch {
          setError("Failed to load audio file.");
        }
      }
    },
    [clearResult, setAudioSource, setError],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      processFileSelection(files, handleAudioReady);
    },
    [processFileSelection, handleAudioReady],
  );

  const handleProcess = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const processed = await applyFade(file, fadeIn, fadeOut);
      const baseName = getFileBaseName(file.name);
      setResult(processed, `${baseName}_fade.wav`);
      setUsedFadeIn(fadeIn);
      setUsedFadeOut(fadeOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply fade");
    } finally {
      stopProcessing();
    }
  }, [file, fadeIn, fadeOut, startProcessing, setResult, setError, stopProcessing]);

  const handleStartOver = useCallback(() => {
    revokeAudio();
    clearResult();
    setFile(null);
    setFadeIn(1);
    setFadeOut(1);
  }, [revokeAudio, clearResult]);

  const handleFadeInChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFadeIn(Number(e.target.value));
  }, []);

  const handleFadeOutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFadeOut(Number(e.target.value));
  }, []);

  const maxFade = useMemo(() => Math.min(duration / 2, 10), [duration]);
  const isDisabled = useMemo(() => fadeIn === 0 && fadeOut === 0, [fadeIn, fadeOut]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<FadeIcon className="w-7 h-7" />}
        iconClass="tool-audio-fade"
        title="Fade Effect"
        description="Add fade in and fade out effects"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Fade Applied!"
          subtitle={`Fade in: ${usedFadeIn}s • Fade out: ${usedFadeOut}s • ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Audio"
          onDownload={download}
          onStartOver={handleStartOver}
          startOverLabel="Process Another"
        >
          <AudioPlayer src={result.url} />
        </SuccessCard>
      ) : isExtracting ? (
        <VideoExtractionProgress state={extractionState} progress={extractionProgress} filename={videoFilename} />
      ) : !file ? (
        <FileDropzone
          accept={AUDIO_VIDEO_EXTENSIONS}
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio or video file here"
          subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
        />
      ) : (
        <div className="space-y-6">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          {audioUrl && <AudioPlayer src={audioUrl} />}

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="input-label">Fade In Duration</span>
                <span className="text-sm font-bold">{fadeIn}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={maxFade}
                step="0.1"
                value={fadeIn}
                onChange={handleFadeInChange}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="input-label">Fade Out Duration</span>
                <span className="text-sm font-bold">{fadeOut}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={maxFade}
                step="0.1"
                value={fadeOut}
                onChange={handleFadeOutChange}
                className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
              />
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleProcess}
            disabled={isDisabled}
            isProcessing={isProcessing}
            processingLabel="Processing..."
            icon={<FadeIcon className="w-5 h-5" />}
            label="Apply Fade"
          />
        </div>
      )}
    </div>
  );
}

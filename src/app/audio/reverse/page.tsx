"use client";

import { useCallback, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
  AudioFileInfo,
  AudioPageHeader,
  ErrorBox,
  SuccessCard,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { LoaderIcon, ReverseIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult, useFileProcessing, useObjectURL, useVideoToAudio } from "@/hooks";
import { formatDuration, formatFileSize, getAudioInfo, reverseAudio } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { getFileBaseName } from "@/lib/utils";

export default function ReverseAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);

  // Use custom hooks
  const { url: audioUrl, setSource: setAudioSource, revoke: revokeAudio } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();

  const processFile = useCallback(
    async (fileToProcess: File) => {
      if (!startProcessing()) return;

      try {
        const info = await getAudioInfo(fileToProcess);
        setDuration(info.duration);
        const processed = await reverseAudio(fileToProcess);
        const baseName = getFileBaseName(fileToProcess.name);
        setResult(processed, `${baseName}_reversed.wav`);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to reverse audio"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setResult, setError, stopProcessing],
  );

  const handleAudioReady = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        clearResult();
        setAudioSource(selectedFile);

        try {
          const info = await getAudioInfo(selectedFile);
          setDuration(info.duration);
        } catch {
          // ignore
        }

        if (isInstant) {
          processFile(selectedFile);
        }
      }
    },
    [isInstant, processFile, clearResult, setAudioSource],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      processFileSelection(files, handleAudioReady);
    },
    [processFileSelection, handleAudioReady],
  );

  const handleClear = useCallback(() => {
    revokeAudio();
    clearResult();
    setFile(null);
    setDuration(0);
  }, [revokeAudio, clearResult]);

  const handleProcess = useCallback(() => {
    if (file) processFile(file);
  }, [file, processFile]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<ReverseIcon className="w-7 h-7" />}
        iconClass="tool-audio-reverse"
        title="Reverse Audio"
        description="Play audio backwards"
      />

      {result ? (
        <SuccessCard
          stampText="Reversed"
          title="Audio Reversed!"
          subtitle={`${formatDuration(duration)} • ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Reversed Audio"
          onDownload={download}
          onStartOver={handleClear}
          startOverLabel="Reverse Another"
        >
          <AudioPlayer src={result.url} />
        </SuccessCard>
      ) : isProcessing ? (
        <div className="border-2 border-foreground p-12 bg-card overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-4 max-w-full">
            <LoaderIcon className="w-8 h-8 animate-spin" />
            <div className="text-center w-full min-w-0">
              <p className="font-bold">Reversing audio...</p>
              <p className="text-sm text-muted-foreground truncate">{file?.name}</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <ErrorBox message={error} />
          <button type="button" onClick={handleClear} className="btn-secondary w-full">
            Try Again
          </button>
        </div>
      ) : isExtracting ? (
        <VideoExtractionProgress state={extractionState} progress={extractionProgress} filename={videoFilename} />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={AUDIO_VIDEO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your audio or video file here"
            subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
          />
          <InfoBox title={isInstant ? "Instant reverse" : "Manual mode"} icon={<ReverseIcon className="w-5 h-5 mt-0.5" />}>
            {isInstant
              ? "Drop an audio file and it will be reversed automatically."
              : "Drop an audio file, preview it, then click to reverse."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <AudioFileInfo file={file} duration={duration} onClear={handleClear} />
          {audioUrl && <AudioPlayer src={audioUrl} />}
          <button type="button" onClick={handleProcess} disabled={isProcessing} className="btn-primary w-full">
            <ReverseIcon className="w-5 h-5" />
            Reverse Audio
          </button>
        </div>
      )}
    </div>
  );
}

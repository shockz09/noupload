"use client";

import { useCallback, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
  AudioFileInfo,
  AudioPageHeader,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { VolumeIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useAudioResult, useFileProcessing, useObjectURL, useVideoToAudio } from "@/hooks";
import { adjustVolume, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { getFileBaseName } from "@/lib/utils";

export default function VolumeAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [usedVolume, setUsedVolume] = useState(100);

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
      const processed = await adjustVolume(file, volume / 100);
      const baseName = getFileBaseName(file.name);
      setResult(processed, `${baseName}_volume.wav`);
      setUsedVolume(volume);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to adjust volume"));
    } finally {
      stopProcessing();
    }
  }, [file, volume, startProcessing, setResult, setError, stopProcessing]);

  const handleStartOver = useCallback(() => {
    revokeAudio();
    clearResult();
    setFile(null);
    setVolume(100);
  }, [revokeAudio, clearResult]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  }, []);

  const isDisabled = volume === 100;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<VolumeIcon className="w-7 h-7" />}
        iconClass="tool-audio-volume"
        title="Adjust Volume"
        description="Increase or decrease audio volume"
      />

      {result ? (
        <SuccessCard
          stampText="Done"
          title="Volume Adjusted!"
          subtitle={`${usedVolume}% volume • ${formatFileSize(result.blob.size)}`}
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="input-label">Volume</span>
              <span className="text-sm font-bold">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="300"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mute</span>
              <span>Normal</span>
              <span>3x Louder</span>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <ProcessButton
            onClick={handleProcess}
            disabled={isDisabled}
            isProcessing={isProcessing}
            processingLabel="Processing..."
            icon={<VolumeIcon className="w-5 h-5" />}
            label="Adjust Volume"
          />
        </div>
      )}
    </div>
  );
}

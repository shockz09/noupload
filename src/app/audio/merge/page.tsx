"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { mergeAudio, isFFmpegLoaded, MergeOutputFormat } from "@/lib/ffmpeg-utils";
import { formatFileSize } from "@/lib/audio-utils";
import { AudioIcon, GripIcon, XIcon, AudioMergeIcon } from "@/components/icons";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  SuccessCard,
  AudioPageHeader,
  VideoExtractionProgress,
} from "@/components/audio/shared";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";

const outputFormats: { value: MergeOutputFormat; label: string; desc: string }[] = [
  { value: "mp3", label: "MP3", desc: "Compressed" },
  { value: "wav", label: "WAV", desc: "Lossless" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "merging";

export default function MergeAudioPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<MergeOutputFormat>("mp3");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { result, setResult, clearResult, download } = useAudioResult();
  const { processFileSelection, extractionState, extractionProgress, isExtracting, videoFilename } = useVideoToAudio();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleAudioReady = useCallback((audioFiles: File[]) => {
    setFiles(prev => [...prev, ...audioFiles]);
    setError(null);
    clearResult();
  }, [clearResult]);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    processFileSelection(newFiles, handleAudioReady);
  }, [processFileSelection, handleAudioReady]);

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFiles = [...files];
    const draggedFile = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, draggedFile);
    setFiles(newFiles);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setError("Please add at least 2 audio files to merge");
      return;
    }

    setError(null);
    setProgress(0);

    try {
      if (!isFFmpegLoaded()) {
        setProcessingState("loading-ffmpeg");
      }

      setProcessingState("merging");

      const blob = await mergeAudio(files, outputFormat, (p) => setProgress(p));

      setResult(blob, `merged_audio.${outputFormat}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge audio");
    } finally {
      setProcessingState("idle");
    }
  };

  const handleStartOver = () => {
    clearResult();
    setFiles([]);
    setError(null);
    setProgress(0);
  };

  const isProcessing = processingState !== "idle";
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<AudioMergeIcon className="w-7 h-7" />}
        iconClass="tool-audio-merge"
        title="Merge Audio"
        description="Combine multiple audio files into one"
      />

      {result ? (
        <SuccessCard
          stampText="Merged"
          title="Audio Merged!"
          subtitle={`${files.length} files combined | ${formatFileSize(result.blob.size)}`}
          downloadLabel="Download Merged Audio"
          onDownload={download}
          onStartOver={handleStartOver}
          startOverLabel="Merge More Files"
        >
          <AudioPlayer src={result.url} />
        </SuccessCard>
      ) : (
        <div className="space-y-4">
          {isExtracting ? (
            <VideoExtractionProgress state={extractionState} progress={extractionProgress} filename={videoFilename} />
          ) : (
            <FileDropzone
              accept={AUDIO_VIDEO_EXTENSIONS}
              multiple={true}
              onFilesSelected={handleFilesSelected}
              title={files.length > 0 ? "Add more audio or video files" : "Drop your audio or video files here"}
              subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
            />
          )}

          {files.length > 0 && (
            <div className="border-2 border-foreground bg-card">
              <div className="px-4 py-2 border-b border-foreground/20 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {files.length} files • {formatFileSize(totalSize)}
                </span>
                <span className="text-xs text-muted-foreground">Drag to reorder</span>
              </div>
              <div className="divide-y divide-foreground/10">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 cursor-grab active:cursor-grabbing transition-colors ${
                      draggedIndex === index ? "bg-muted/50" : "hover:bg-muted/30"
                    }`}
                  >
                    <GripIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="w-6 h-6 flex items-center justify-center bg-foreground text-background text-xs font-bold shrink-0">
                      {index + 1}
                    </span>
                    <AudioIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length >= 2 && (
            <div className="border-2 border-foreground p-4 bg-card space-y-3">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Output Format</label>
              <div className="flex gap-2">
                {outputFormats.map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setOutputFormat(fmt.value)}
                    className={`flex-1 p-3 border-2 text-center transition-all ${
                      outputFormat === fmt.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block font-bold">{fmt.label}</span>
                    <span className={`block text-xs ${outputFormat === fmt.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {fmt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {files.length >= 2 && !isFFmpegLoaded() && <FFmpegNotice />}

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <ProgressBar
              progress={progress}
              label={processingState === "loading-ffmpeg" ? "Loading audio engine..." : "Merging audio files..."}
            />
          )}

          {files.length >= 2 && (
            <ProcessButton
              onClick={handleMerge}
              isProcessing={isProcessing}
              processingLabel={processingState === "loading-ffmpeg" ? "Loading..." : "Merging..."}
              icon={<AudioMergeIcon className="w-5 h-5" />}
              label={`Merge ${files.length} Files`}
            />
          )}

          {files.length === 1 && (
            <p className="text-center text-sm text-muted-foreground">Add at least one more file to merge</p>
          )}
        </div>
      )}
    </div>
  );
}

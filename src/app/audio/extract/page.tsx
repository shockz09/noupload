"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { extractAudioFromVideo, isFFmpegLoaded, ExtractOutputFormat } from "@/lib/ffmpeg-utils";
import { formatFileSize, downloadAudio } from "@/lib/audio-utils";
import { ExtractIcon, VideoIcon, DownloadIcon } from "@/components/icons";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

const outputFormats: { value: ExtractOutputFormat; label: string; desc: string }[] = [
  { value: "mp3", label: "MP3", desc: "Compressed, universal" },
  { value: "wav", label: "WAV", desc: "Lossless, larger" },
  { value: "ogg", label: "OGG", desc: "Open format" },
  { value: "flac", label: "FLAC", desc: "Lossless, compressed" },
];

const bitrates = [
  { value: 128, label: "128", desc: "Standard" },
  { value: 192, label: "192", desc: "High" },
  { value: 256, label: "256", desc: "Very High" },
  { value: 320, label: "320", desc: "Maximum" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "extracting";

export default function ExtractAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExtractOutputFormat>("mp3");
  const [bitrate, setBitrate] = useState(192);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleExtract = async () => {
    if (!file) return;

    setError(null);
    setProgress(0);

    try {
      if (!isFFmpegLoaded()) {
        setProcessingState("loading-ffmpeg");
      }

      setProcessingState("extracting");

      const blob = await extractAudioFromVideo(file, outputFormat, bitrate, (p) => setProgress(p));

      const baseName = file.name.split(".").slice(0, -1).join(".");
      setResult({ blob, filename: `${baseName}.${outputFormat}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract audio");
    } finally {
      setProcessingState("idle");
    }
  };

  const handleDownload = () => {
    if (result) {
      downloadAudio(result.blob, result.filename);
    }
  };

  const handleStartOver = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const isLossless = outputFormat === "wav" || outputFormat === "flac";
  const isProcessing = processingState !== "idle";

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<ExtractIcon className="w-7 h-7" />}
        iconClass="tool-audio-extract"
        title="Extract Audio"
        description="Extract audio track from any video file"
      />

      {result ? (
        <div className="animate-fade-up">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Extracted</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Audio Extracted!</h2>

              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">From</p>
                  <p className="text-xl font-bold">{file?.name.split(".").pop()?.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file?.size || 0)}</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-foreground text-background">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">To</p>
                  <p className="text-xl font-bold">{outputFormat.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(result.blob.size)}</p>
                </div>
              </div>
            </div>

            <button onClick={handleDownload} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download {outputFormat.toUpperCase()}
            </button>
          </div>
          <button onClick={handleStartOver} className="btn-secondary w-full mt-4">
            Extract Another
          </button>
        </div>
      ) : !file ? (
        <FileDropzone
          accept=".mp4,.mov,.mkv,.avi,.webm,.flv,.wmv,.m4v,.3gp"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your video file here"
          subtitle="MP4, MOV, MKV, AVI, WebM, FLV, WMV"
        />
      ) : (
        <div className="space-y-4">
          <AudioFileInfo
            file={file}
            onClear={handleStartOver}
            icon={<VideoIcon className="w-5 h-5 shrink-0" />}
          />

          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Output Format</label>
              <div className="grid grid-cols-4 gap-2">
                {outputFormats.map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setOutputFormat(fmt.value)}
                    className={`p-2 border-2 text-center transition-all ${
                      outputFormat === fmt.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                  >
                    <span className="block font-bold text-sm">{fmt.label}</span>
                    <span className={`block text-xs ${outputFormat === fmt.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {fmt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {!isLossless && (
              <div className="space-y-2 pt-2 border-t border-foreground/10">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quality (kbps)</label>
                <div className="flex gap-1">
                  {bitrates.map((br) => (
                    <button
                      key={br.value}
                      onClick={() => setBitrate(br.value)}
                      className={`flex-1 px-2 py-2 text-center border-2 transition-all ${
                        bitrate === br.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/30 hover:border-foreground"
                      }`}
                    >
                      <span className="block text-sm font-bold">{br.value}</span>
                      <span className={`block text-xs ${bitrate === br.value ? "text-background/70" : "text-muted-foreground"}`}>
                        {br.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isFFmpegLoaded() && <FFmpegNotice />}

          {error && <ErrorBox message={error} />}

          {isProcessing && (
            <ProgressBar
              progress={progress}
              label={processingState === "loading-ffmpeg" ? "Loading audio engine..." : "Extracting audio..."}
            />
          )}

          <ProcessButton
            onClick={handleExtract}
            isProcessing={isProcessing}
            processingLabel={processingState === "loading-ffmpeg" ? "Loading..." : "Extracting..."}
            icon={<ExtractIcon className="w-5 h-5" />}
            label="Extract Audio"
          />
        </div>
      )}
    </div>
  );
}

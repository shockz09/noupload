"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { convertAudioFormat, formatDuration, formatFileSize, getAudioInfo, downloadAudio, AudioFormat } from "@/lib/audio-utils";
import { convertAudioFFmpeg, isFFmpegLoaded, ConvertOutputFormat } from "@/lib/ffmpeg-utils";
import { ConvertIcon, DownloadIcon } from "@/components/icons";
import {
  FFmpegNotice,
  ProgressBar,
  ErrorBox,
  ProcessButton,
  AudioFileInfo,
  AudioPageHeader,
} from "@/components/audio/shared";

type OutputFormat = "mp3" | "wav" | "ogg" | "flac" | "aac" | "webm";

const outputFormats: { value: OutputFormat; label: string; desc: string; needsFFmpeg: boolean }[] = [
  { value: "mp3", label: "MP3", desc: "Universal", needsFFmpeg: false },
  { value: "wav", label: "WAV", desc: "Lossless", needsFFmpeg: false },
  { value: "ogg", label: "OGG", desc: "Open format", needsFFmpeg: true },
  { value: "flac", label: "FLAC", desc: "Lossless", needsFFmpeg: true },
  { value: "aac", label: "AAC", desc: "Apple/web", needsFFmpeg: true },
  { value: "webm", label: "WebM", desc: "Web video", needsFFmpeg: true },
];

const bitrates = [
  { value: 128, label: "128", desc: "Standard" },
  { value: 192, label: "192", desc: "High" },
  { value: 256, label: "256", desc: "Very High" },
  { value: 320, label: "320", desc: "Maximum" },
];

type ProcessingState = "idle" | "loading-ffmpeg" | "converting";

export default function AudioConvertPage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("mp3");
  const [bitrate, setBitrate] = useState(192);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const handleFileSelected = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setResult(null);

      try {
        const info = await getAudioInfo(selectedFile);
        setDuration(info.duration);
      } catch {
        // Duration not critical
      }
    }
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);

    try {
      const selectedFormat = outputFormats.find(f => f.value === outputFormat);
      const needsFFmpeg = selectedFormat?.needsFFmpeg ?? false;

      let blob: Blob;

      if (needsFFmpeg) {
        if (!isFFmpegLoaded()) {
          setProcessingState("loading-ffmpeg");
        }
        setProcessingState("converting");

        blob = await convertAudioFFmpeg(file, outputFormat as ConvertOutputFormat, bitrate, (p) => setProgress(p));
      } else {
        setProcessingState("converting");
        blob = await convertAudioFormat(file, outputFormat as AudioFormat, { bitrate });
      }

      const baseName = file.name.split(".").slice(0, -1).join(".");
      setResult({ blob, filename: `${baseName}.${outputFormat}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
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

  const inputFormat = file?.name.split(".").pop()?.toUpperCase() || "AUDIO";
  const selectedFormat = outputFormats.find(f => f.value === outputFormat);
  const needsFFmpeg = selectedFormat?.needsFFmpeg ?? false;
  const isLossless = outputFormat === "wav" || outputFormat === "flac";
  const isProcessing = processingState !== "idle";

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<ConvertIcon className="w-7 h-7" />}
        iconClass="tool-audio-convert"
        title="Convert Audio"
        description="Convert between audio formats"
      />

      {result ? (
        <div className="animate-fade-up">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Converted</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">Conversion Complete!</h2>

              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">From</p>
                  <p className="text-xl font-bold">{inputFormat}</p>
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
            Convert Another
          </button>
        </div>
      ) : !file ? (
        <FileDropzone
          accept=".mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio file here"
          subtitle="MP3, WAV, OGG, M4A, WebM, AAC, FLAC"
        />
      ) : (
        <div className="space-y-4">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Output Format</label>
              <div className="grid grid-cols-3 gap-2">
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

          {needsFFmpeg && !isFFmpegLoaded() && <FFmpegNotice />}

          {error && <ErrorBox message={error} />}

          {isProcessing && needsFFmpeg && (
            <ProgressBar
              progress={progress}
              label={processingState === "loading-ffmpeg" ? "Loading audio engine..." : "Converting..."}
            />
          )}

          <ProcessButton
            onClick={handleConvert}
            isProcessing={isProcessing}
            processingLabel={processingState === "loading-ffmpeg" ? "Loading..." : "Converting..."}
            icon={<ConvertIcon className="w-5 h-5" />}
            label={`Convert to ${outputFormat.toUpperCase()}`}
          />
        </div>
      )}
    </div>
  );
}

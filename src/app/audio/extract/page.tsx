"use client";

import { useCallback, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
  AudioFileInfo,
  AudioPageHeader,
  ErrorBox,
  FFmpegNotice,
  ProcessButton,
  ProgressBar,
} from "@/components/audio/shared";
import { DownloadIcon, LoaderIcon } from "@/components/icons/ui";
import { ExtractIcon, VideoIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { FormatSelector, InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult } from "@/hooks";
import { formatFileSize } from "@/lib/audio-utils";
import { AUDIO_BITRATES } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { type ExtractOutputFormat, extractAudioFromVideo, isFFmpegLoaded } from "@/lib/ffmpeg-utils";
import { getFileBaseName } from "@/lib/utils";

const outputFormats: {
  value: ExtractOutputFormat;
  label: string;
  desc: string;
}[] = [
  { value: "mp3", label: "MP3", desc: "Compressed" },
  { value: "wav", label: "WAV", desc: "Lossless" },
  { value: "ogg", label: "OGG", desc: "Open format" },
  { value: "flac", label: "FLAC", desc: "Lossless" },
];

export default function ExtractAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<ExtractOutputFormat>("mp3");
  const [bitrate, setBitrate] = useState(192);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { result, setResult, clearResult, download } = useAudioResult();
  const processingRef = useRef(false);

  const processFile = useCallback(
    async (fileToProcess: File, format: ExtractOutputFormat = "mp3", br: number = 192) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      setError(null);
      setProgress(0);

      try {
        if (!isFFmpegLoaded()) setProcessingStatus("Loading audio engine...");
        setProcessingStatus("Extracting audio...");
        const blob = await extractAudioFromVideo(fileToProcess, format, br, (p) => setProgress(p));
        const baseName = getFileBaseName(fileToProcess.name);
        setResult(blob, `${baseName}.${format}`);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to extract audio"));
      } finally {
        setIsProcessing(false);
        processingRef.current = false;
        setProcessingStatus("");
      }
    },
    [setResult],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        setError(null);
        clearResult();
        if (isInstant) {
          processFile(selectedFile, "mp3", 192);
        }
      }
    },
    [isInstant, processFile, clearResult],
  );

  const handleClear = () => {
    clearResult();
    setFile(null);
    setError(null);
    setProgress(0);
  };

  const isLossless = outputFormat === "wav" || outputFormat === "flac";

  if (!isLoaded) return null;

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
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">To</p>
                  <p className="text-xl font-bold">{result.filename.split(".").pop()?.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(result.blob.size)}</p>
                </div>
              </div>
            </div>
            <AudioPlayer src={result.url} />
            <button type="button" onClick={download} className="btn-success w-full mb-4">
              <DownloadIcon className="w-5 h-5" />
              Download
            </button>
          </div>
          <button type="button" onClick={handleClear} className="btn-secondary w-full mt-4">
            Extract Another
          </button>
        </div>
      ) : isProcessing ? (
        <div className="border-2 border-foreground p-12 bg-card">
          <div className="flex flex-col items-center justify-center gap-4">
            <LoaderIcon className="w-8 h-8 animate-spin" />
            <div className="text-center">
              <p className="font-bold">{processingStatus || "Processing..."}</p>
              <p className="text-sm text-muted-foreground">{file?.name}</p>
            </div>
            <div className="w-full max-w-xs h-2 bg-muted border-2 border-foreground">
              <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${progress}%` }} />
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
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".mp4,.mov,.mkv,.avi,.webm,.flv,.wmv,.m4v,.3gp"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, MKV, AVI, WebM, FLV, WMV"
          />
          {!isFFmpegLoaded() && <FFmpegNotice />}
          <InfoBox title={isInstant ? "Instant extraction" : "Manual mode"} icon={<VideoIcon className="w-5 h-5 mt-0.5" />}>
            {isInstant
              ? "Drop a video and audio will be extracted as MP3 automatically."
              : "Drop a video, choose format and quality, then extract."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-4">
          <AudioFileInfo file={file} onClear={handleClear} icon={<VideoIcon className="w-5 h-5" />} />

          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            <FormatSelector
              label="Output Format"
              formats={outputFormats}
              value={outputFormat}
              onChange={(v) => setOutputFormat(v as ExtractOutputFormat)}
              columns={4}
            />

            {!isLossless && (
              <div className="space-y-2 pt-2 border-t border-foreground/10">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quality (kbps)</span>
                <div className="flex gap-1">
                  {AUDIO_BITRATES.map((br) => (
                    <button
                      type="button"
                      key={br.value}
                      onClick={() => setBitrate(br.value)}
                      className={`flex-1 px-2 py-2 text-center border-2 transition-all ${
                        bitrate === br.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/30 hover:border-foreground"
                      }`}
                    >
                      <span className="block text-sm font-bold">{br.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isFFmpegLoaded() && <FFmpegNotice />}
          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label={processingStatus} />}

          <ProcessButton
            onClick={() => processFile(file, outputFormat, bitrate)}
            isProcessing={isProcessing}
            processingLabel="Extracting..."
            icon={<ExtractIcon className="w-5 h-5" />}
            label="Extract Audio"
          />
        </div>
      )}
    </div>
  );
}

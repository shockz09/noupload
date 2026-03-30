"use client";

import { useCallback, useState } from "react";
import { VideoToolIcon } from "@/components/icons/video";
import { ExtractIcon } from "@/components/icons/audio";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, SuccessCard, VideoFileInfo, VideoPageHeader } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { extractAudio, type AudioOutputFormat } from "@/lib/video/extract-audio";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

const FORMATS: { key: AudioOutputFormat; label: string; desc: string }[] = [
  { key: "mp3", label: "MP3", desc: "Universal" },
  { key: "wav", label: "WAV", desc: "Lossless" },
  { key: "aac", label: "AAC", desc: "Apple / Web" },
  { key: "ogg", label: "OGG", desc: "Open format" },
];

export default function ExtractAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<AudioOutputFormat>("mp3");
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, fmt: AudioOutputFormat) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await extractAudio(f, fmt, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to extract audio"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setFile(files[0]);
      setResult(null);
      clearError();
      if (isInstant) processFile(files[0], format);
    },
    [isInstant, processFile, format, clearError],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename);
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    clearError();
  }, [clearError]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: result.blob.type,
      size: result.blob.size,
      fileType: "audio",
      sourceToolLabel: "Extract Audio",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<ExtractIcon className="w-7 h-7" />}
        iconClass="tool-audio-extract"
        title="Extract Audio"
        description="Extract audio track from video"
      />

      {result ? (
        <SuccessCard
          stampText="Extracted"
          title="Audio Extracted!"
          subtitle={`${format.toUpperCase()} · ${formatFileSize(result.blob.size)}`}
          downloadLabel={`Download ${format.toUpperCase()}`}
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Extract Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox>{isInstant ? "Drop a video and audio will be extracted automatically." : "Extracts the audio track from your video into a separate file."}</InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />

          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Output Format</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group">
                {FORMATS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFormat(f.key)}
                    className={`p-3 rounded-lg border-2 transition-all text-center ${
                      format === f.key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{f.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{f.desc}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {error && <ErrorBox message={error} />}

          <button type="button" onClick={() => processFile(file, format)} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Extracting... {Math.round(progress)}%
              </>
            ) : (
              <>
                <ExtractIcon className="w-5 h-5" />
                Extract as {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

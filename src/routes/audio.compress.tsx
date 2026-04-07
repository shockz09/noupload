import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/audio/compress")({
	head: () => ({
		meta: [
			{ title: "Compress Audio Free - Reduce Audio File Size | noupload" },
			{ name: "description", content: "Compress audio files for free. Reduce MP3, WAV, and other audio file sizes. Works offline, completely private." },
			{ name: "keywords", content: "compress audio, reduce audio size, audio compressor, shrink audio, free audio compression" },
			{ property: "og:title", content: "Compress Audio Free - Reduce Audio File Size" },
			{ property: "og:description", content: "Compress audio files for free. Works 100% offline." },
		],
	}),
	component: AudioCompressPage,
});

import { useCallback, useState } from "react";
import {
  AudioFileInfo,
  AudioPageHeader,
  AudioResultView,
  ErrorBox,
} from "@/components/audio/shared";
import { CompressIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing, useObjectURL } from "@/hooks";
import { getAudioInfo } from "@/lib/audio-utils";
import { compressAudio } from "@/lib/audio/compress";
import { AUDIO_EXTENSIONS } from "@/lib/constants";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";

// ── Presets ─────────────────────────────────────────────────
type PresetKey = "light" | "balanced" | "maximum";

interface Preset {
  label: string;
  description: string;
  bitrate: number; // bits per second
}

const PRESETS: Record<PresetKey, Preset> = {
  light: {
    label: "Light",
    description: "High quality, moderate reduction",
    bitrate: 192_000,
  },
  balanced: {
    label: "Balanced",
    description: "Good quality, smaller file",
    bitrate: 128_000,
  },
  maximum: {
    label: "Maximum",
    description: "Smallest size, decent quality",
    bitrate: 64_000,
  },
};

function AudioCompressPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [result, setResult] = useState<{ blob: Blob; filename: string; originalSize: number; compressedSize: number } | null>(null);
  const { url: resultUrl, setSource: setResultSource, revoke: revokeResult } = useObjectURL();

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, bitrate: number) => {
      if (!startProcessing()) return;
      setResult(null);

      try {
        const compressed = await compressAudio(f, bitrate, (p) => setProgress(p * 100));
        setResult(compressed);
        setResultSource(compressed.blob);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to compress audio"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      setResult(null);
      clearError();

      try {
        const info = await getAudioInfo(f);
        setDuration(info.duration);
      } catch {
        // Duration not critical
      }

      if (isInstant) {
        processFile(f, PRESETS.balanced.bitrate);
      }
    },
    [clearError, isInstant, processFile],
  );

  const handleCompress = useCallback(() => {
    if (!file) return;
    processFile(file, PRESETS[preset].bitrate);
  }, [file, preset, processFile]);

  const handleDownload = useCallback(() => {
    if (result) downloadBlob(result.blob, result.filename, "audio/mp4");
  }, [result]);

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    revokeResult();
    setDuration(0);
    clearError();
  }, [clearError, revokeResult]);

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "audio/mp4",
      size: result.blob.size,
      fileType: "other",
      sourceToolLabel: "Compress Audio",
    });
  }, [result, addToBuffer]);

  const savings = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<CompressIcon className="w-7 h-7" />}
        iconClass="tool-audio-compress"
        title="Compress Audio"
        description="Reduce audio file size"
      />

      {result ? (
        result.compressedSize >= result.originalSize ? (
          <div className="animate-fade-up space-y-6">
            <div className="p-6 border-2 border-foreground bg-card text-center space-y-4">
              <h2 className="text-2xl font-display">Already Optimized</h2>
              <p className="text-muted-foreground">
                This audio is already well-compressed. Re-encoding produced a larger file ({formatFileSize(result.compressedSize)} vs {formatFileSize(result.originalSize)}).
              </p>
              <button type="button" onClick={handleStartOver} className="btn-secondary">
                Try Another File
              </button>
            </div>
          </div>
        ) : resultUrl ? (
          <AudioResultView
            url={resultUrl}
            blobSize={result.blob.size}
            title="Audio Compressed!"
            subtitle={`${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} · ${savings}% smaller`}
            downloadLabel="Download Audio"
            onDownload={handleDownload}
            onHoldInBuffer={handleHoldInBuffer}
            onStartOver={handleStartOver}
            startOverLabel="Compress Another"
          />
        ) : null
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={AUDIO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your audio file here"
            subtitle="MP3, WAV, OGG, M4A, AAC, FLAC"
          />
          <div className="flex items-start gap-3 p-4 border-2 border-foreground/30 bg-muted/30 text-sm">
            <p className="text-muted-foreground">
              {isInstant
                ? "Drop a file and it will be compressed automatically."
                : "Compresses audio to AAC format. Works great for WAV, FLAC, and high-bitrate files."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Compression Level</legend>
              <div className="grid grid-cols-3 gap-3" role="group">
                {(["light", "balanced", "maximum"] as PresetKey[]).map((key) => {
                  const p = PRESETS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreset(key)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        preset === key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="font-medium capitalize text-sm">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {error && <ErrorBox message={error} />}

          <button type="button" onClick={handleCompress} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Compressing... {Math.round(progress)}%
              </>
            ) : (
              <>
                <CompressIcon className="w-5 h-5" />
                Compress Audio
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/audio/convert")({
	head: () => ({
		meta: [
			{ title: "Convert Audio Free - MP3 WAV OGG M4A Converter | noupload" },
			{ name: "description", content: "Convert audio between formats for free. MP3, WAV, OGG, M4A, AAC, FLAC. Extract audio from video. Works offline, completely private." },
			{ name: "keywords", content: "audio converter, convert audio, mp3 converter, wav converter, audio format converter, free audio converter" },
			{ property: "og:title", content: "Convert Audio Free - MP3 WAV OGG M4A Converter" },
			{ property: "og:description", content: "Convert audio between formats for free. Works 100% offline." },
		],
	}),
	component: AudioConvertPage,
});

import { useCallback, useState } from "react";
import {
  AudioFileInfo,
  AudioPageHeader,
  AudioResultView,
  ErrorBox,
} from "@/components/audio/shared";
import { ConvertIcon } from "@/components/icons/image";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult, useFileProcessing } from "@/hooks";
import { getAudioInfo } from "@/lib/audio-utils";
import { convertAudio, type AudioOutputFormat } from "@/lib/audio/convert";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";

const FORMATS: { key: AudioOutputFormat; label: string; desc: string }[] = [
  { key: "mp3", label: "MP3", desc: "Universal" },
  { key: "wav", label: "WAV", desc: "Lossless" },
  { key: "ogg", label: "OGG", desc: "Open format" },
  { key: "flac", label: "FLAC", desc: "Lossless" },
  { key: "aac", label: "AAC", desc: "Apple/web" },
];

const BITRATES = [
  { value: 64, desc: "Low" },
  { value: 128, desc: "Good" },
  { value: 192, desc: "High" },
  { value: 320, desc: "Best" },
];

function AudioConvertPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [outputFormat, setOutputFormat] = useState<AudioOutputFormat>("mp3");
  const [bitrate, setBitrate] = useState(192);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();
  const { result, setResult, clearResult, download } = useAudioResult();

  const processFile = useCallback(
    async (f: File, fmt: AudioOutputFormat, br: number) => {
      if (!startProcessing()) return;

      try {
        const r = await convertAudio(f, fmt, br * 1000, (p) => setProgress(p * 100));
        setResult(r.blob, r.filename);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to convert audio"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setResult, setError, stopProcessing],
  );

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      clearResult();
      clearError();

      try {
        const info = await getAudioInfo(f);
        setDuration(info.duration);
      } catch {
        // Duration not critical
      }

      if (isInstant) {
        processFile(f, "mp3", 192);
      }
    },
    [clearResult, clearError, isInstant, processFile],
  );

  const handleConvert = useCallback(() => {
    if (!file) return;
    processFile(file, outputFormat, bitrate);
  }, [file, outputFormat, bitrate, processFile]);

  const handleStartOver = useCallback(() => {
    clearResult();
    setFile(null);
    setDuration(0);
    clearError();
  }, [clearResult, clearError]);

  const inputFormat = file?.name.split(".").pop()?.toUpperCase() || "AUDIO";
  const isLossless = outputFormat === "wav" || outputFormat === "flac";

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <AudioPageHeader
        icon={<ConvertIcon className="w-7 h-7" />}
        iconClass="tool-audio-convert"
        title="Convert Audio"
        description="Convert between audio formats"
      />

      {result ? (
        <AudioResultView
          url={result.url}
          blobSize={result.blob.size}
          title="Conversion Complete!"
          subtitle={`${inputFormat} → ${outputFormat.toUpperCase()}`}
          downloadLabel={`Download ${outputFormat.toUpperCase()}`}
          onDownload={download}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        />
      ) : !file ? (
        <FileDropzone
          accept={AUDIO_VIDEO_EXTENSIONS}
          multiple={false}
          onFilesSelected={handleFileSelected}
          title="Drop your audio or video file here"
          subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
        />
      ) : (
        <div className="space-y-4">
          <AudioFileInfo file={file} duration={duration} onClear={handleStartOver} />

          <div className="border-2 border-foreground p-4 bg-card space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Output Format</legend>
              <div className="grid grid-cols-5 gap-2">
                {FORMATS.map((f) => (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => setOutputFormat(f.key)}
                    className={`px-3 py-3 text-sm font-bold border-2 border-foreground transition-colors ${outputFormat === f.key ? "bg-foreground text-background" : "hover:bg-muted"}`}
                  >
                    <span className="block">{f.label}</span>
                    <span className={`block text-xs ${outputFormat === f.key ? "text-background/70" : "text-muted-foreground"}`}>{f.desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {!isLossless && (
              <div className="space-y-2 pt-2 border-t border-foreground/10">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quality (kbps)</span>
                <div className="flex gap-1">
                  {BITRATES.map((br) => (
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
                      <span className={`block text-xs ${bitrate === br.value ? "text-background/70" : "text-muted-foreground"}`}>
                        {br.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <ErrorBox message={error} />}

          <button type="button" onClick={handleConvert} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Converting... {Math.round(progress)}%
              </>
            ) : (
              <>
                <ConvertIcon className="w-5 h-5" />
                Convert to {outputFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { VideoConvertIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, SuccessCard, VideoFileInfo, VideoPageHeader } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { convertVideo, type OutputFormat } from "@/lib/video/convert";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";

const FORMATS: { key: OutputFormat; label: string; desc: string }[] = [
  { key: "mp4", label: "MP4", desc: "Universal, plays everywhere" },
  { key: "mov", label: "MOV", desc: "Apple / Final Cut Pro" },
  { key: "webm", label: "WebM", desc: "Web-optimized, smaller" },
  { key: "mkv", label: "MKV", desc: "Flexible, all codecs" },
];

export default function ConvertVideoPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutputFormat>("mp4");
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, fmt: OutputFormat) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await convertVideo(f, fmt, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to convert video"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const EXT_TO_FORMAT: Record<string, string> = { mp4: "mp4", m4v: "mp4", mov: "mov", webm: "webm", mkv: "mkv" };

  // Filter out source format from available options
  const sourceExt = file?.name.split(".").pop()?.toLowerCase() || "";
  const sourceFormat = EXT_TO_FORMAT[sourceExt] || "";
  const availableFormats = FORMATS.filter((f) => f.key !== sourceFormat);

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      setResult(null);
      clearError();
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      const src = EXT_TO_FORMAT[ext] || "";
      const firstAvailable = FORMATS.find((fmt) => fmt.key !== src);
      if (firstAvailable) setFormat(firstAvailable.key);
      if (isInstant && firstAvailable) processFile(f, firstAvailable.key);
    },
    [isInstant, processFile, clearError],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename);
    },
    [result, format],
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
      fileType: "other",
      sourceToolLabel: "Convert Video",
    });
  }, [result, format, addToBuffer]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoConvertIcon className="w-7 h-7" />}
        iconClass="tool-video-convert"
        title="Convert Video"
        description="Convert between video formats"
      />

      {result ? (
        <SuccessCard
          stampText="Converted"
          title="Video Converted!"
          subtitle={`${format.toUpperCase()} · ${formatFileSize(result.blob.size)}`}
          downloadLabel={`Download ${format.toUpperCase()}`}
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Convert Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox>{isInstant ? "Drop a video and it will be converted automatically." : "Converts video to a different container format. Transmuxes when possible for speed."}</InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />
          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Output Format</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group">
                {availableFormats.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFormat(f.key)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
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
                Converting... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoConvertIcon className="w-5 h-5" />
                Convert to {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

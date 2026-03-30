"use client";

import { useCallback, useState } from "react";
import { VideoMetadataIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, VideoPageHeader } from "@/components/video/shared";
import { useFileProcessing } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { getVideoMetadata, type VideoMetadata } from "@/lib/video/metadata";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

interface MetadataRow {
  label: string;
  value: string;
}

function getMetadataRows(file: File, meta: VideoMetadata): MetadataRow[] {
  const rows: MetadataRow[] = [
    { label: "Filename", value: file.name },
    { label: "File Size", value: formatFileSize(file.size) },
    { label: "Format", value: meta.format },
    { label: "MIME Type", value: meta.mimeType },
    { label: "Duration", value: formatDuration(meta.duration) },
    { label: "Resolution", value: `${meta.width} × ${meta.height}` },
  ];

  if (meta.rotation) rows.push({ label: "Rotation", value: `${meta.rotation}°` });

  rows.push(
    { label: "Video Codec", value: meta.videoCodec },
    { label: "Video Bitrate", value: formatBitrate(meta.videoBitrate) },
    { label: "Frame Rate", value: `${meta.fps.toFixed(2)} fps` },
    { label: "Audio Codec", value: meta.audioCodec },
    { label: "Audio Bitrate", value: formatBitrate(meta.audioBitrate) },
  );

  if (meta.numberOfChannels > 0) {
    rows.push(
      { label: "Audio Channels", value: meta.numberOfChannels === 1 ? "Mono" : meta.numberOfChannels === 2 ? "Stereo" : `${meta.numberOfChannels}` },
      { label: "Sample Rate", value: `${meta.sampleRate} Hz` },
    );
  }

  return rows;
}

export default function VideoMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const { isProcessing, error, startProcessing, stopProcessing, setError, clearError } = useFileProcessing();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      setMetadata(null);
      clearError();

      if (!startProcessing()) return;
      try {
        const meta = await getVideoMetadata(f);
        setMetadata(meta);
      } catch (err) {
        setError(getErrorMessage(err, "Could not read video metadata"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, stopProcessing, setError, clearError],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setMetadata(null);
    clearError();
  }, [clearError]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoMetadataIcon className="w-7 h-7" />}
        iconClass="tool-video-metadata"
        title="Video Metadata"
        description="View video file information"
      />

      {!file ? (
        <FileDropzone
          accept={VIDEO_EXTENSIONS}
          multiple={false}
          maxSize={VIDEO_MAX_FILE_SIZE}
          onFilesSelected={handleFileSelected}
          title="Drop your video file here"
          subtitle="MP4, MOV, WebM, MKV"
        />
      ) : (
        <div className="space-y-6">
          {/* File header */}
          <div className="file-item">
            <div className="pdf-icon-box">
              <VideoToolIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={handleStartOver}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Change file
            </button>
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3 p-4 border-2 border-foreground/30 bg-muted/30">
              <span className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              <span className="text-sm font-medium text-muted-foreground">Reading metadata...</span>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          {metadata && (
            <div className="border-2 border-foreground">
              {getMetadataRows(file, metadata).map((row) => (
                <div key={row.label} className="flex items-center border-b border-foreground/20 last:border-b-0">
                  <div className="w-1/3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    {row.label}
                  </div>
                  <div className="flex-1 px-4 py-3 font-medium text-sm">{row.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

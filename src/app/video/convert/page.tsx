"use client";

import { useCallback, useMemo, useState } from "react";
import { DownloadIcon } from "@/components/icons/ui";
import { VideoConvertIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, ProgressBar, SuccessCard, VideoFileInfo, VideoPageHeader } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob, downloadMultiple } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { convertVideo, type OutputFormat } from "@/lib/video/convert";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

const FORMATS: { key: OutputFormat; label: string; desc: string }[] = [
  { key: "mp4", label: "MP4", desc: "Universal, plays everywhere" },
  { key: "mov", label: "MOV", desc: "Apple / Final Cut Pro" },
  { key: "webm", label: "WebM", desc: "Web-optimized, smaller" },
  { key: "mkv", label: "MKV", desc: "Flexible, all codecs" },
];

const EXT_TO_FORMAT: Record<string, string> = { mp4: "mp4", m4v: "mp4", mov: "mov", webm: "webm", mkv: "mkv" };

// ── Bulk types ──────────────────────────────────────────────
interface BulkFileItem {
  id: string;
  file: File;
}

interface BulkConvertItem {
  filename: string;
  originalName: string;
  size: number;
  blob: Blob;
  error?: string;
}

// ── Format Selector ─────────────────────────────────────────
function FormatSelector({
  format,
  onSelect,
  available,
}: {
  format: OutputFormat;
  onSelect: (key: OutputFormat) => void;
  available: typeof FORMATS;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Output Format</legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group">
        {available.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onSelect(f.key)}
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
  );
}

// ── Component ───────────────────────────────────────────────

export default function ConvertVideoPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [format, setFormat] = useState<OutputFormat>("mp4");

  // ── Single mode state ──
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  // ── Bulk mode state ──
  const [bulkFiles, setBulkFiles] = useState<BulkFileItem[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkConvertItem[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const isBulk = bulkFiles.length > 0 || bulkResults.length > 0;

  // Single mode: filter out source format
  const sourceExt = file?.name.split(".").pop()?.toLowerCase() || "";
  const sourceFormat = EXT_TO_FORMAT[sourceExt] || "";
  const availableFormats = FORMATS.filter((f) => f.key !== sourceFormat);

  // ── Single mode handlers ──
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

  const handleFileSelected = useCallback(
    (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) return;

      if (selectedFiles.length === 1 && bulkFiles.length === 0) {
        // Single mode
        const f = selectedFiles[0];
        setFile(f);
        setResult(null);
        clearError();
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        const src = EXT_TO_FORMAT[ext] || "";
        const firstAvailable = FORMATS.find((fmt) => fmt.key !== src);
        if (firstAvailable) setFormat(firstAvailable.key);
        if (isInstant && firstAvailable) processFile(f, firstAvailable.key);
      } else {
        // Bulk mode
        const newItems = selectedFiles.map((f) => ({ id: crypto.randomUUID(), file: f }));
        setBulkFiles((prev) => [...prev, ...newItems]);
        setBulkResults([]);
      }
    },
    [isInstant, processFile, clearError, bulkFiles.length],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename);
    },
    [result],
  );

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
  }, [result, addToBuffer]);

  // ── Bulk mode handlers ──
  const handleRemoveBulkFile = useCallback((id: string) => {
    setBulkFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleBulkConvert = useCallback(async () => {
    if (bulkFiles.length === 0 || isBulkProcessing) return;

    setIsBulkProcessing(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: bulkFiles.length });

    const results: BulkConvertItem[] = [];

    for (let i = 0; i < bulkFiles.length; i++) {
      const { file: f } = bulkFiles[i];
      try {
        const r = await convertVideo(f, format);
        results.push({
          filename: r.filename,
          originalName: f.name,
          size: r.blob.size,
          blob: r.blob,
        });
      } catch (err) {
        results.push({
          filename: f.name,
          originalName: f.name,
          size: 0,
          blob: new Blob(),
          error: getErrorMessage(err, "Failed"),
        });
      }
      setBulkProgress({ current: i + 1, total: bulkFiles.length });
      setBulkResults([...results]);
    }

    setIsBulkProcessing(false);
  }, [bulkFiles, format, isBulkProcessing]);

  const successfulResults = useMemo(
    () => bulkResults.filter((r) => !r.error),
    [bulkResults],
  );

  const handleBulkDownloadAll = useCallback(() => {
    downloadMultiple(successfulResults.map((r) => ({ data: r.blob, filename: r.filename })));
  }, [successfulResults]);

  const handleBulkDownloadOne = useCallback((item: BulkConvertItem) => {
    downloadBlob(item.blob, item.filename);
  }, []);

  // ── Shared handlers ──
  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    clearError();
    setBulkFiles([]);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: 0 });
  }, [clearError]);

  const totalBulkSize = useMemo(
    () => bulkFiles.reduce((sum, f) => sum + f.file.size, 0),
    [bulkFiles],
  );

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoConvertIcon className="w-7 h-7" />}
        iconClass="tool-video-convert"
        title="Convert Video"
        description="Convert between video formats"
      />

      {/* ── Single mode result ── */}
      {!isBulk && result ? (
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

      /* ── Bulk mode results ── */
      ) : isBulk && bulkResults.length > 0 && !isBulkProcessing ? (
        <div className="animate-fade-up space-y-6">
          <div className="success-card">
            <div className="success-stamp">
              <span className="success-stamp-text">Done</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="space-y-4 mb-6">
              <h2 className="text-3xl font-display">
                {successfulResults.length} Video{successfulResults.length !== 1 ? "s" : ""} Converted!
              </h2>
              <p className="text-muted-foreground">All converted to {format.toUpperCase()}</p>
            </div>
            {successfulResults.length > 0 && (
              <button type="button" onClick={handleBulkDownloadAll} className="btn-success w-full mb-4">
                <DownloadIcon className="w-5 h-5" />
                Download All ({successfulResults.length} files)
              </button>
            )}
          </div>

          <div className="space-y-2">
            {bulkResults.map((item, i) => {
              if (item.error) {
                return (
                  <div key={i} className="flex items-center justify-between p-3 border-2 border-destructive/50 bg-destructive/5">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.originalName}</p>
                      <p className="text-xs text-destructive">{item.error}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(item.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBulkDownloadOne(item)}
                    className="text-sm font-bold text-primary hover:underline ml-4"
                  >
                    Download
                  </button>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={handleStartOver} className="btn-secondary w-full">
            Convert More Videos
          </button>
        </div>

      /* ── No files: dropzone ── */
      ) : !file && !isBulk ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={true}
            maxFiles={20}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Drop your video files here"
            subtitle="MP4, MOV, WebM, MKV · Single or multiple files"
          />
          <InfoBox>{isInstant ? "Drop a video and it will be converted automatically." : "Converts video to a different container format. Transmuxes when possible for speed."}</InfoBox>
        </div>

      /* ── Single mode: file selected ── */
      ) : !isBulk && file ? (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />

          {!isProcessing && <FormatSelector format={format} onSelect={setFormat} available={availableFormats} />}

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

      /* ── Bulk mode: files selected ── */
      ) : (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={true}
            maxFiles={20}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFileSelected}
            title="Add more videos"
            subtitle="MP4, MOV, WebM, MKV"
            compact
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="input-label">{bulkFiles.length} videos selected</span>
              <button
                type="button"
                onClick={handleStartOver}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                disabled={isBulkProcessing}
              >
                Clear all
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-foreground p-2">
              {bulkFiles.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 px-2 hover:bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <VideoToolIcon className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(item.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveBulkFile(item.id)}
                    className="text-xs text-muted-foreground hover:text-foreground ml-2"
                    disabled={isBulkProcessing}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Total: {formatFileSize(totalBulkSize)}</p>
          </div>

          {!isBulkProcessing && <FormatSelector format={format} onSelect={setFormat} available={FORMATS} />}

          {/* Live results during processing */}
          {isBulkProcessing && bulkResults.length > 0 && (
            <div className="space-y-2">
              {bulkResults.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 border-2 ${
                    item.error ? "border-destructive/50 bg-destructive/5" : "border-foreground bg-background"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.error ? item.originalName : item.filename}</p>
                    <p className={`text-xs ${item.error ? "text-destructive" : "text-muted-foreground"}`}>{item.error || formatFileSize(item.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isBulkProcessing && (
            <ProgressBar
              progress={(bulkProgress.current / bulkProgress.total) * 100}
              label={`Converting ${bulkProgress.current} of ${bulkProgress.total}...`}
            />
          )}

          <button
            type="button"
            onClick={handleBulkConvert}
            disabled={isBulkProcessing || bulkFiles.length === 0}
            className="btn-primary w-full"
          >
            {isBulkProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <VideoConvertIcon className="w-5 h-5" />
                Convert {bulkFiles.length} Video{bulkFiles.length !== 1 ? "s" : ""} to {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

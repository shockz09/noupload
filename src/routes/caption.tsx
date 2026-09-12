import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/caption")({
  head: () => ({
    meta: [
      { title: "Free Subtitle Generator - Auto Captions for Video & Audio | noupload" },
      {
        name: "description",
        content:
          "Generate accurate subtitles from any video or audio file for free. Word-level timing, editable lines, download SRT or VTT. Runs on your own GPU — nothing is uploaded.",
      },
      {
        name: "keywords",
        content:
          "subtitle generator, auto captions, srt generator, vtt, transcribe video, speech to text, free subtitles, offline transcription",
      },
      { property: "og:title", content: "Free Subtitle Generator - Auto Captions for Video & Audio" },
      {
        property: "og:description",
        content: "Turn speech into timed, editable subtitles in your browser. Download SRT or VTT. 100% private.",
      },
    ],
  }),
  component: CaptionPage,
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaptionStage } from "@/components/caption/CaptionStage";
import { CueList } from "@/components/caption/CueList";
import { DownloadMenu } from "@/components/caption/DownloadMenu";
import { CaptionIcon } from "@/components/icons/audio";
import { CopyIcon } from "@/components/icons/ui";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, PageHeader } from "@/components/shared";
import { useDock } from "@/components/shared/DockToggle";
import { useFileBuffer } from "@/hooks";
import { clock, toSRT, toText, toVTT } from "@/lib/caption/cues";
import { clearModelCache, MODEL_TOTAL_BYTES } from "@/lib/caption/model";
import { useCaptioner } from "@/lib/caption/useCaptioner";
import { AUDIO_VIDEO_EXTENSIONS, isVideoFile, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";
import { downloadText } from "@/lib/download";
import { formatFileSize } from "@/lib/utils";

/** The app measures files in MiB everywhere; the model is no exception. */
const MODEL_SIZE = formatFileSize(MODEL_TOTAL_BYTES);

/** "about 40 sec left" reads better than a countdown that jitters. */
function remaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds >= 90) return `about ${Math.round(seconds / 60)} min left`;
  return `about ${Math.max(5, Math.round(seconds / 5) * 5)} sec left`;
}

function tookLabel(seconds: number): string {
  if (seconds < 1.5) return "about a second";
  if (seconds < 90) return `${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function CaptionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const mediaRef = useRef<HTMLVideoElement>(null);

  const { model, run, cues, peaks, finished, error, start, cancel, reset, editCue } = useCaptioner();
  const { isDockEnabled } = useDock();
  const { add: addToBuffer } = useFileBuffer();

  const baseName = useMemo(() => file?.name.replace(/\.[^.]+$/, "") || "captions", [file]);
  const isVideo = file ? isVideoFile(file.name) : true;
  const unsupported = model.failure === "no-webgpu";

  useEffect(() => {
    if (!mediaUrl) return;
    return () => URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl]);

  const handleFiles = useCallback(
    (files: File[]) => {
      const picked = files[0];
      if (!picked) return;
      setFile(picked);
      setMediaUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(picked);
      });
      setActiveIndex(-1);
      setCacheCleared(false);
      void start(picked);
    },
    [start],
  );

  const startOver = useCallback(() => {
    reset();
    setFile(null);
    setMediaUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setActiveIndex(-1);
  }, [reset]);

  const seek = useCallback((time: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = time;
    void media.play().catch(() => {
      // Autoplay can be refused; the seek still happened, which is the point.
    });
  }, []);

  // Space plays and pauses, the way every video tool does — but not while a
  // subtitle is being typed into, and not while a button has focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.tagName === "BUTTON" || target?.tagName === "INPUT") return;
      const media = mediaRef.current;
      if (!media?.src) return;
      event.preventDefault();
      if (media.paused) void media.play().catch(() => {});
      else media.pause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const download = useCallback(
    (ext: string) => {
      const body = ext === "vtt" ? toVTT(cues) : ext === "txt" ? toText(cues) : toSRT(cues);
      downloadText(body, `${baseName}.${ext}`);
    },
    [cues, baseName],
  );

  const copyTranscript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toText(cues));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      downloadText(toText(cues), `${baseName}.txt`);
    }
  }, [cues, baseName]);

  // Same convention as every other tool: with the dock on, the finished file is
  // waiting there without anyone having to ask for it.
  const bufferedRef = useRef(false);
  useEffect(() => {
    if (!finished || !isDockEnabled || bufferedRef.current || cues.length === 0) return;
    bufferedRef.current = true;
    const blob = new Blob([toSRT(cues)], { type: "text/plain" });
    addToBuffer({
      filename: `${baseName}.srt`,
      blob,
      mimeType: "text/plain",
      size: blob.size,
      fileType: "other",
      sourceToolLabel: "Subtitles",
    });
  }, [finished, isDockEnabled, cues, baseName, addToBuffer]);
  useEffect(() => {
    if (run.phase === "idle") bufferedRef.current = false;
  }, [run.phase]);

  const elapsed = (performance.now() - run.startedAt) / 1000;
  const rate = run.secondsDone > 0 ? run.secondsDone / elapsed : 0;
  const modelFraction = model.bytesTotal > 0 ? model.bytesReady / model.bytesTotal : 0;
  const waitingOnModel = model.phase === "fetching" || model.phase === "compiling";

  return (
    <div className="page-enter max-w-3xl mx-auto space-y-8">
      <PageHeader
        icon={<CaptionIcon className="w-7 h-7" />}
        iconClass="tool-caption"
        title="Subtitles"
        description="Turn speech into timed, editable captions"
        backHref="/"
        backLabel={isVideo ? "Back to Video Tools" : "Back to Audio Tools"}
        tabKey={isVideo ? "video" : "audio"}
      />

      {unsupported ? (
        <div className="space-y-4">
          <ErrorBox message="This browser cannot run the speech model yet." />
          <InfoBox title="Subtitling needs WebGPU">
            Chrome, Edge or Arc on a computer will work today. On iPhone or iPad it needs iOS 26 or newer. Everything
            else in noupload works regardless.
          </InfoBox>
        </div>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={AUDIO_VIDEO_EXTENSIONS}
            multiple={false}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleFiles}
            title="Drop a video or audio file here"
            subtitle="MP4, MOV, MKV, WebM, MP3, WAV, M4A"
          />

          <InfoBox title="Runs on your own machine">
            Speech recognition happens on your GPU, in this tab. The file never leaves your device. The first run
            downloads a {MODEL_SIZE} model once — after that it works with no network at all.
          </InfoBox>

          <ModelChip
            phase={model.phase}
            fraction={modelFraction}
            bytesReady={model.bytesReady}
            cleared={cacheCleared}
            onClear={async () => {
              await clearModelCache();
              setCacheCleared(true);
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {mediaUrl && (
            <CaptionStage
              src={mediaUrl}
              cues={cues}
              duration={run.duration}
              peaks={peaks}
              mediaRef={mediaRef}
              onActiveChange={setActiveIndex}
            />
          )}

          {error && <ErrorBox message={error} />}

          {/* One status line, whatever the current wait happens to be. */}
          {run.phase !== "done" && !error && (
            <div className="border-2 border-foreground p-4 space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="font-bold">
                  {waitingOnModel
                    ? model.phase === "compiling"
                      ? "Getting the model ready"
                      : "Downloading the speech model"
                    : run.phase === "reading"
                      ? "Reading the audio"
                      : `Subtitling ${clock(run.secondsDone)} of ${clock(run.duration)}`}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {waitingOnModel
                    ? model.phase === "fetching"
                      ? `${formatFileSize(model.bytesReady)} of ${formatFileSize(model.bytesTotal)}`
                      : ""
                    : rate > 0
                      ? remaining((run.duration - run.secondsDone) / rate)
                      : ""}
                </span>
              </div>

              <div className="h-2 border-2 border-foreground bg-background">
                <div
                  className={`h-full bg-foreground transition-[width] duration-300 ${
                    run.phase === "reading" || model.phase === "compiling" ? "animate-pulse" : ""
                  }`}
                  style={{
                    width: `${Math.round(
                      100 *
                        (waitingOnModel
                          ? modelFraction
                          : run.phase === "reading"
                            ? Math.max(0.04, run.readFraction)
                            : run.duration > 0
                              ? run.secondsDone / run.duration
                              : 0),
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {waitingOnModel
                    ? `Downloaded once, then kept on this device. ${MODEL_SIZE}.`
                    : "Subtitles appear below as they are made — you can watch along already."}
                </p>
                <button
                  type="button"
                  onClick={() => (cues.length > 0 ? cancel() : startOver())}
                  className="ml-auto shrink-0 text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {cues.length > 0 ? "Stop here" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {finished && (
            <div className="animate-fade-up space-y-3 border-t-2 border-foreground pt-4">
              <p className="text-sm">
                <b className="font-bold">
                  {cues.length} subtitle{cues.length === 1 ? "" : "s"}
                </b>
                <span className="text-muted-foreground">
                  {" "}
                  for {clock(run.duration)} of {isVideo ? "video" : "audio"} · {tookLabel(run.tookSeconds)}
                  {run.tookSeconds > 0 && run.duration > 0
                    ? ` · ${(run.duration / run.tookSeconds).toFixed(1)}× realtime`
                    : ""}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <DownloadMenu onDownload={download} />

                <button
                  type="button"
                  onClick={copyTranscript}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CopyIcon className="h-4 w-4" />
                  {copied ? "Copied" : "Copy text"}
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={startOver}
                  className="text-sm font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  New file
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Click any line to fix it, or a timecode to jump there. Edits are included in the download.
              </p>
            </div>
          )}

          <CueList cues={cues} activeIndex={activeIndex} editable={finished} onSeek={seek} onEdit={editCue} />

          {cues.length === 0 && run.phase !== "idle" && !error && (
            <div className="border-2 border-dashed border-foreground/30 p-6 text-sm text-muted-foreground">
              Subtitles will appear here as they are made.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Quiet line about the model, for people who care where the 240 MB went. */
function ModelChip({
  phase,
  fraction,
  bytesReady,
  cleared,
  onClear,
}: {
  phase: string;
  fraction: number;
  bytesReady: number;
  cleared: boolean;
  onClear: () => void;
}) {
  if (cleared) {
    return <p className="text-xs text-muted-foreground">Model removed from this device.</p>;
  }

  if (phase === "ready") {
    return (
      <p className="text-xs text-muted-foreground">
        Speech model ready · stored on this device ·{" "}
        <button type="button" onClick={onClear} className="underline underline-offset-2 hover:text-foreground">
          remove it
        </button>
      </p>
    );
  }

  if (phase === "fetching" || phase === "compiling") {
    return (
      <p className="text-xs text-muted-foreground">
        {phase === "compiling"
          ? "Preparing the speech model…"
          : `Downloading the speech model — ${Math.round(fraction * 100)}% (${formatFileSize(bytesReady)})`}
      </p>
    );
  }

  return null;
}

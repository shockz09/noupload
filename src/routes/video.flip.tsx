import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/flip")({
  head: () => ({
    meta: [
      { title: "Flip Video Free - Mirror a Video Online | noupload" },
      {
        name: "description",
        content:
          "Flip a video for free. Mirror it left-to-right to undo a selfie camera, or top-to-bottom. Runs entirely in your browser — nothing is uploaded.",
      },
      {
        name: "keywords",
        content:
          "flip video, mirror video, video flipper, flip video horizontally, mirror mp4, unmirror selfie video, free video flip",
      },
      { property: "og:title", content: "Flip Video Free - Mirror a Video Online" },
      { property: "og:description", content: "Mirror videos in your browser. Works 100% offline." },
    ],
  }),
  component: FlipVideoPage,
});

import { useCallback, useRef, useState } from "react";
import { FlipHorizontalIcon, FlipVerticalIcon } from "@/components/icons/image";
import { VideoFlipIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
  ErrorBox,
  InfoBox,
  PreviewPlayOverlay,
  VideoFileInfo,
  VideoPageHeader,
  VideoResultView,
} from "@/components/video/shared";
import { useFileBuffer, useFileProcessing, useObjectURL } from "@/hooks";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { flipVideo, type Mirror } from "@/lib/video/flip";
import { analyzeForTransform, type VideoTransformInfo } from "@/lib/video/orientation";

const NO_MIRROR: Mirror = { horizontal: false, vertical: false };

/** Reads the choice back as a phrase, for the status line and the result card. */
function describe({ horizontal, vertical }: Mirror): string {
  if (horizontal && vertical) return "Mirrored both ways";
  if (horizontal) return "Mirrored left-to-right";
  return "Mirrored top-to-bottom";
}

/**
 * Why this particular choice is fast or slow.
 *
 * Worth spelling out rather than just showing a spinner: the difference between the
 * two paths is seconds against minutes, and "both ways" quietly being the cheap one is
 * surprising enough to deserve a sentence.
 */
function costNote({ horizontal, vertical }: Mirror, canCopy: boolean): string {
  if (horizontal !== vertical) {
    return "A mirror has to be drawn into every frame, so this one re-encodes the video. Longer clips take a while.";
  }
  if (!canCopy) {
    return "This video's codec has to be re-encoded to become an MP4, so this one takes a little longer.";
  }
  return "Mirroring both ways is the same map as a half turn, which an MP4 keeps in its header — so the video is copied across untouched, in seconds.";
}

interface FlipOutcome {
  blob: Blob;
  filename: string;
  videoReEncoded: boolean;
  mirror: Mirror;
}

function FlipVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoTransformInfo | null>(null);
  const [mirror, setMirror] = useState<Mirror>(NO_MIRROR);
  const [result, setResult] = useState<FlipOutcome | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  /** The file whose analysis is allowed to win, so a stale read can't overwrite it. */
  const analyzing = useRef<File | null>(null);
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const reset = useCallback(() => {
    revokePreview();
    setFile(null);
    setInfo(null);
    setMirror(NO_MIRROR);
    setResult(null);
    setPreviewFailed(false);
    clearError();
  }, [revokePreview, clearError]);

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      const selected = files[0];
      if (!selected) return;

      setFile(selected);
      setPreview(selected);
      setInfo(null);
      setMirror(NO_MIRROR);
      setResult(null);
      setPreviewFailed(false);
      clearError();

      // Pick another file while this one is still being read and the slower answer
      // must not land on top of the newer one.
      analyzing.current = selected;
      try {
        const info = await analyzeForTransform(selected);
        if (analyzing.current === selected) setInfo(info);
      } catch (err) {
        if (analyzing.current === selected) setError(getErrorMessage(err, "Could not read this video."));
      }
    },
    [setPreview, clearError, setError],
  );

  const toggleHorizontal = useCallback(() => setMirror((m) => ({ ...m, horizontal: !m.horizontal })), []);
  const toggleVertical = useCallback(() => setMirror((m) => ({ ...m, vertical: !m.vertical })), []);

  const handleApply = useCallback(async () => {
    if (!file) return;
    if (!startProcessing()) return;

    try {
      const flipped = await flipVideo(file, mirror, (p) => setProgress(p * 100));
      setResult({ ...flipped, mirror });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to flip video"));
    } finally {
      stopProcessing();
    }
  }, [file, mirror, startProcessing, setProgress, setError, stopProcessing]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename, "video/mp4");
    },
    [result],
  );

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    addToBuffer({
      filename: result.filename,
      blob: result.blob,
      mimeType: "video/mp4",
      size: result.blob.size,
      fileType: "video",
      sourceToolLabel: "Flip Video",
    });
  }, [result, addToBuffer]);

  const touched = mirror.horizontal || mirror.vertical;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoFlipIcon className="w-7 h-7" />}
        iconClass="tool-video-flip"
        title="Flip Video"
        description="Mirror a video left-to-right or top-to-bottom"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Video Flipped!"
          subtitle={[
            describe(result.mirror),
            info && `${info.width}×${info.height}`,
            result.videoReEncoded ? "re-encoded" : "video copied untouched",
          ]
            .filter(Boolean)
            .join(" · ")}
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={reset}
          startOverLabel="Flip Another"
        />
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            maxSize={VIDEO_MAX_FILE_SIZE}
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox title="Undo a selfie camera">
            Front cameras record you mirrored, so text in the shot reads backwards. Flipping left-to-right puts it right
            again. Everything happens on your machine — the video never leaves it.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo
            file={file}
            duration={info?.duration}
            resolution={info ? `${info.width}×${info.height}` : undefined}
            onClear={reset}
            icon={<VideoToolIcon className="w-5 h-5" />}
          />

          {!info ? (
            error ? (
              <ErrorBox message={error} />
            ) : (
              <p className="text-sm text-muted-foreground">Reading video…</p>
            )
          ) : (
            <div className="space-y-4">
              {/* The video is the subject, so the frame hugs it: the stage takes the
                  video's own aspect ratio and the video fills it. A mirror never
                  changes the shape of the frame, so nothing here has to move. */}
              <div
                className="relative h-72 sm:h-80 max-w-full mx-auto border-2 border-foreground bg-muted/30 overflow-hidden"
                style={{ aspectRatio: `${info.width} / ${info.height}` }}
              >
                {previewFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <div
                      className="border-2 border-dashed border-muted-foreground/40"
                      style={{ height: "70%", aspectRatio: `${info.width} / ${info.height}` }}
                    />
                    <p className="text-xs text-muted-foreground">
                      This browser can't play the file, but it can still flip it.
                    </p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      src={preview ?? undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={() => setPreviewFailed(true)}
                      style={{
                        transform: `scaleX(${mirror.horizontal ? -1 : 1}) scaleY(${mirror.vertical ? -1 : 1})`,
                      }}
                      className="absolute inset-0 w-full h-full object-contain transition-transform duration-300 ease-out"
                    />
                    <PreviewPlayOverlay videoRef={videoRef} />
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleHorizontal}
                  aria-pressed={mirror.horizontal}
                  className={`flex items-center justify-center gap-2 whitespace-nowrap border-2 border-foreground px-3 py-3 text-xs font-bold transition-colors sm:text-sm ${
                    mirror.horizontal ? "bg-foreground text-background" : "hover:bg-foreground/10"
                  }`}
                >
                  <FlipHorizontalIcon className="w-4 h-4" />
                  Mirror left-right
                </button>
                <button
                  type="button"
                  onClick={toggleVertical}
                  aria-pressed={mirror.vertical}
                  className={`flex items-center justify-center gap-2 whitespace-nowrap border-2 border-foreground px-3 py-3 text-xs font-bold transition-colors sm:text-sm ${
                    mirror.vertical ? "bg-foreground text-background" : "hover:bg-foreground/10"
                  }`}
                >
                  <FlipVerticalIcon className="w-4 h-4" />
                  Mirror top-bottom
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <p>
                  {touched ? (
                    <span className="font-bold text-foreground">{describe(mirror)}</span>
                  ) : (
                    `Untouched · ${info.width}×${info.height}`
                  )}
                </p>
                {touched && (
                  <button
                    type="button"
                    onClick={() => setMirror(NO_MIRROR)}
                    className="font-semibold hover:text-foreground shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>

              {touched && <p className="text-xs text-muted-foreground">{costNote(mirror, info.canCopy)}</p>}

              {error && <ErrorBox message={error} />}

              <button
                type="button"
                onClick={handleApply}
                disabled={isProcessing || !touched}
                className="btn-primary w-full"
              >
                {isProcessing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Flipping... {Math.round(progress)}%
                  </>
                ) : (
                  <>
                    <VideoFlipIcon className="w-5 h-5" />
                    {touched ? "Flip Video" : "Pick a direction"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

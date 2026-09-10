import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/rotate")({
	head: () => ({
		meta: [
			{ title: "Rotate Video Free - Turn Videos 90° Online | noupload" },
			{ name: "description", content: "Rotate video for free. Turn a sideways video 90, 180 or 270 degrees without re-encoding, so quality stays untouched. Works offline, completely private." },
			{ name: "keywords", content: "rotate video, video rotator, turn video, rotate mp4, sideways video, free video rotate" },
			{ property: "og:title", content: "Rotate Video Free - Turn Videos 90° Online" },
			{ property: "og:description", content: "Rotate videos without losing quality. Works 100% offline." },
		],
	}),
	component: RotateVideoPage,
});

import { useCallback, useRef, useState } from "react";
import { RotateLeftIcon, RotateRightIcon } from "@/components/icons/ui";
import { VideoRotateIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, PreviewPlayOverlay, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useFileBuffer, useFileProcessing, useObjectURL } from "@/hooks";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { analyzeForTransform, type VideoTransformInfo } from "@/lib/video/orientation";
import { rotateVideo, type RotationAngle } from "@/lib/video/rotate";

interface RotateResult {
  blob: Blob;
  filename: string;
  angle: RotationAngle;
  videoReEncoded: boolean;
}

function RotateVideoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoTransformInfo | null>(null);
  const [rotation, setRotation] = useState<RotationAngle>(0);
  const [result, setResult] = useState<RotateResult | null>(null);
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
    setRotation(0);
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
      setRotation(0);
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

  const rotateLeft = useCallback(() => setRotation((r) => ((r + 270) % 360) as RotationAngle), []);
  const rotateRight = useCallback(() => setRotation((r) => ((r + 90) % 360) as RotationAngle), []);

  const rotate = useCallback(
    async (angle: Exclude<RotationAngle, 0>, bake: boolean) => {
      if (!file) return;
      if (!startProcessing()) return;

      try {
        const rotated = await rotateVideo(file, angle, { bake }, (p) => setProgress(p * 100));
        setResult({ ...rotated, angle });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to rotate video"));
      } finally {
        stopProcessing();
      }
    },
    [file, startProcessing, setProgress, setError, stopProcessing],
  );

  const handleApply = useCallback(() => {
    if (rotation !== 0) rotate(rotation, false);
  }, [rotation, rotate]);

  // Offered only after the fact: the header rotation every player we know of reads
  // is right for practically everyone, so this stays out of the way until someone
  // actually meets a player that ignores it.
  const handleReEncode = useCallback(() => {
    if (result) rotate(result.angle as Exclude<RotationAngle, 0>, true);
  }, [result, rotate]);

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
      sourceToolLabel: "Rotate Video",
    });
  }, [result, addToBuffer]);

  // A quarter turn swaps the frame; a half turn leaves it alone.
  const quarterTurn = (result?.angle ?? rotation) % 180 !== 0;
  const outWidth = info ? (quarterTurn ? info.height : info.width) : 0;
  const outHeight = info ? (quarterTurn ? info.width : info.height) : 0;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoRotateIcon className="w-7 h-7" />}
        iconClass="tool-video-rotate"
        title="Rotate Video"
        description="Turn a sideways video upright, 90° at a time"
      />

      {result ? (
        <div className="space-y-3">
          <VideoResultView
            blob={result.blob}
            title="Video Rotated!"
            subtitle={[
              `Rotated ${result.angle}°`,
              outWidth > 0 && `${outWidth}×${outHeight}`,
              result.videoReEncoded ? "re-encoded" : "video copied untouched",
            ]
              .filter(Boolean)
              .join(" · ")}
            downloadLabel="Download Video"
            onDownload={handleDownload}
            onHoldInBuffer={handleHoldInBuffer}
            onStartOver={reset}
            startOverLabel="Rotate Another"
          />
          {!result.videoReEncoded && (
            <p className="text-xs text-muted-foreground text-center">
              Still sideways in some other app?{" "}
              <button
                type="button"
                onClick={handleReEncode}
                disabled={isProcessing}
                className="font-semibold text-foreground underline hover:no-underline disabled:opacity-60"
              >
                {isProcessing ? `Re-encoding… ${Math.round(progress)}%` : "Re-encode it into the frames"}
              </button>
            </p>
          )}
        </div>
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
          <InfoBox title="No re-encoding">
            An MP4 stores its rotation in the file header, so turning an MP4 or MOV only rewrites that header — the
            video itself is copied across untouched, in seconds.
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
                  output's aspect ratio and the video is sized against the stage's own
                  box, swapped on a quarter turn so the turned frame fits exactly.
                  Container units do that swap without measuring anything in JS. */}
              <div
                className="relative h-72 sm:h-80 max-w-full mx-auto border-2 border-foreground bg-muted/30 overflow-hidden [container-type:size] transition-all duration-300 ease-out"
                style={{ aspectRatio: `${outWidth} / ${outHeight}` }}
              >
                {previewFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <div
                      className="border-2 border-dashed border-muted-foreground/40 transition-all duration-300"
                      style={{
                        height: "70%",
                        aspectRatio: `${outWidth} / ${outHeight}`,
                      }}
                    />
                    <p className="text-xs text-muted-foreground">This browser can't play the file, but it can still rotate it.</p>
                  </div>
                ) : (
                  <>
                    {/* Centred by transform, not auto margins: a quarter turn makes the
                        element wider than the stage, and auto margins give up on
                        centring once that happens. max-w-none for the same reason —
                        preflight caps a video at 100% width. */}
                    <video
                      ref={videoRef}
                      src={preview ?? undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={() => setPreviewFailed(true)}
                      style={{
                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                        width: quarterTurn ? "100cqh" : "100cqw",
                        height: quarterTurn ? "100cqw" : "100cqh",
                      }}
                      className="absolute left-1/2 top-1/2 max-w-none object-contain transition-all duration-300 ease-out"
                    />
                    <PreviewPlayOverlay videoRef={videoRef} />
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={rotateLeft}
                  className="flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
                >
                  <RotateLeftIcon className="w-4 h-4" />
                  Rotate left
                </button>
                <button
                  type="button"
                  onClick={rotateRight}
                  className="flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
                >
                  <RotateRightIcon className="w-4 h-4" />
                  Rotate right
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <p>
                  {rotation === 0 ? (
                    `No rotation yet · ${info.width}×${info.height}`
                  ) : (
                    <>
                      <span className="font-bold text-foreground">{rotation}°</span> · {info.width}×{info.height} →{" "}
                      <span className="font-bold text-foreground">
                        {outWidth}×{outHeight}
                      </span>
                    </>
                  )}
                </p>
                {rotation !== 0 && (
                  <button
                    type="button"
                    onClick={() => setRotation(0)}
                    className="font-semibold hover:text-foreground shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>

              {!info.canCopy && (
                <p className="text-xs text-muted-foreground">
                  This video's codec has to be re-encoded to become an MP4, so this one takes a little longer.
                </p>
              )}

              {error && <ErrorBox message={error} />}

              <button
                type="button"
                onClick={handleApply}
                disabled={isProcessing || rotation === 0}
                className="btn-primary w-full"
              >
                {isProcessing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Rotating... {Math.round(progress)}%
                  </>
                ) : (
                  <>
                    <VideoRotateIcon className="w-5 h-5" />
                    {rotation === 0 ? "Pick a rotation" : `Rotate ${rotation}°`}
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

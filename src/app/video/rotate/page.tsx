"use client";

import { useCallback, useState } from "react";
import { VideoRotateIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { rotateVideo, type RotationAngle } from "@/lib/video/rotate";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";

export default function RotateVideoPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState<RotationAngle>(90);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File, a: RotationAngle) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await rotateVideo(f, a, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to rotate video"));
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
      if (isInstant) processFile(files[0], angle);
    },
    [isInstant, processFile, angle, clearError],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.blob, result.filename, "video/mp4");
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
      mimeType: "video/mp4",
      size: result.blob.size,
      fileType: "other",
      sourceToolLabel: "Rotate Video",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoRotateIcon className="w-7 h-7" />}
        iconClass="tool-video-rotate"
        title="Rotate Video"
        description="Rotate video by 90°, 180°, or 270°"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Video Rotated!"
          subtitle={`Rotated ${angle}°`}
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Rotate Another"
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
          <InfoBox>{isInstant ? "Drop a video and it will be rotated automatically." : "Rotates your video. Uses metadata rotation when possible for instant results."}</InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />
          {!isProcessing && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Rotation</legend>
              <div className="grid grid-cols-3 gap-3" role="group">
                {([90, 180, 270] as RotationAngle[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAngle(a)}
                    className={`p-3 rounded-lg border-2 transition-all text-center ${
                      angle === a ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{a}°</div>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && <ErrorBox message={error} />}
          <button type="button" onClick={() => processFile(file, angle)} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Rotating... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoRotateIcon className="w-5 h-5" />
                Rotate {angle}°
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

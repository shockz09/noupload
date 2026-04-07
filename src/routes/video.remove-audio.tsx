import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/remove-audio")({
	head: () => ({
		meta: [
			{ title: "Remove Audio from Video Free - Mute Video Online | noupload" },
			{ name: "description", content: "Remove audio track from video for free. Mute video files. Works offline, completely private." },
			{ name: "keywords", content: "remove audio, mute video, silent video, remove sound, video without audio, free audio remover" },
			{ property: "og:title", content: "Remove Audio from Video Free - Mute Video Online" },
			{ property: "og:description", content: "Remove audio from video for free. Works 100% offline." },
		],
	}),
	component: RemoveAudioPage,
});

import { useCallback, useState } from "react";
import { RemoveAudioIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { removeAudio } from "@/lib/video/remove-audio";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

function RemoveAudioPage() {
  const { isInstant, isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFile = useCallback(
    async (f: File) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await removeAudio(f, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to remove audio"));
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
      if (isInstant) processFile(files[0]);
    },
    [isInstant, processFile, clearError],
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
      sourceToolLabel: "Remove Audio",
    });
  }, [result, addToBuffer]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<RemoveAudioIcon className="w-7 h-7" />}
        iconClass="tool-video-remove-audio"
        title="Remove Audio"
        description="Strip audio track from video"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Audio Removed!"
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Process Another"
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
          <InfoBox title={isInstant ? "Instant processing" : "About this tool"}>
            {isInstant
              ? "Drop a video and the audio will be removed automatically."
              : "Removes the audio track from your video. The video quality stays the same."}
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo file={file} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />
          {error && <ErrorBox message={error} />}
          <button type="button" onClick={() => processFile(file)} disabled={isProcessing} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Removing audio... {Math.round(progress)}%
              </>
            ) : (
              <>
                <RemoveAudioIcon className="w-5 h-5" />
                Remove Audio
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

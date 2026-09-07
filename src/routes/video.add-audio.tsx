import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/add-audio")({
  head: () => ({
    meta: [
      { title: "Add Audio to Video Free - Replace Audio Track | noupload" },
      {
        name: "description",
        content:
          "Add an audio track to a video for free. Replace the sound with music or narration. Works offline, completely private.",
      },
      {
        name: "keywords",
        content:
          "add audio to video, replace audio, add music to video, add soundtrack, audio over video, free audio adder",
      },
      { property: "og:title", content: "Add Audio to Video Free - Replace Audio Track" },
      { property: "og:description", content: "Add an audio track to a video for free. Works 100% offline." },
    ],
  }),
  component: AddAudioPage,
});

import { useCallback, useState } from "react";
import { AudioFileInfo } from "@/components/audio/shared";
import { AudioIcon } from "@/components/icons/audio";
import { AddAudioIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import {
  AUDIO_EXTENSIONS,
  MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS,
  VIDEO_MAX_FILE_SIZE,
} from "@/lib/constants";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { addAudio } from "@/lib/video/add-audio";

function AddAudioPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDragActive, setAudioDragActive] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const processFiles = useCallback(
    async (video: File, audio: File) => {
      if (!startProcessing()) return;
      setResult(null);
      try {
        const r = await addAudio(video, audio, (p) => setProgress(p * 100));
        setResult(r);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to add audio"));
      } finally {
        stopProcessing();
      }
    },
    [startProcessing, setProgress, setError, stopProcessing],
  );

  const handleVideoSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setVideoFile(files[0]);
      setResult(null);
      clearError();
    },
    [clearError],
  );

  const handleAudioSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!AUDIO_EXTENSIONS.split(",").includes(ext)) {
        setError("Please choose an audio file (MP3, WAV, AAC, M4A, OGG, FLAC).");
        return;
      }
      setAudioFile(f);
      setResult(null);
      clearError();
    },
    [clearError, setError],
  );

  const handleAudioDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setAudioDragActive(false);
      if (e.dataTransfer.files.length > 0) handleAudioSelected(Array.from(e.dataTransfer.files));
    },
    [handleAudioSelected],
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
    setVideoFile(null);
    setAudioFile(null);
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
      fileType: "video",
      sourceToolLabel: "Add Audio",
    });
  }, [result, addToBuffer]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<AddAudioIcon className="w-7 h-7" />}
        iconClass="tool-video-remove-audio"
        title="Add Audio"
        description="Replace a video's audio with your own track"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Audio Added!"
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Process Another"
        />
      ) : !videoFile ? (
        // Step 1 — pick the video. Single dropzone, just like Extract Audio.
        <div className="space-y-6">
          <FileDropzone
            accept={VIDEO_EXTENSIONS}
            multiple={false}
            maxSize={VIDEO_MAX_FILE_SIZE}
            onFilesSelected={handleVideoSelected}
            title="Drop your video file here"
            subtitle="MP4, MOV, WebM, MKV"
          />
          <InfoBox title="About this tool">
            Replaces the video's existing audio with an audio file of your choice. The audio is trimmed to match the
            video's length.
          </InfoBox>
        </div>
      ) : (
        // Step 2 — video is loaded, now choose the audio track to add.
        <div className="space-y-6">
          <VideoFileInfo file={videoFile} onClear={handleStartOver} icon={<VideoToolIcon className="w-5 h-5" />} />

          {audioFile ? (
            <AudioFileInfo
              file={audioFile}
              onClear={() => setAudioFile(null)}
              icon={<AudioIcon className="w-5 h-5" />}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Now add the audio track</p>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setAudioDragActive(true);
                }}
                onDragLeave={() => setAudioDragActive(false)}
                onDrop={handleAudioDrop}
                className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors text-center ${
                  audioDragActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <AudioIcon className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Drop your audio file or click to browse</span>
                <span className="text-xs text-muted-foreground">MP3, WAV, AAC, M4A, OGG, FLAC</span>
                <input
                  type="file"
                  accept={AUDIO_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) handleAudioSelected(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          {audioFile && (
            <button
              type="button"
              onClick={() => processFiles(videoFile, audioFile)}
              disabled={isProcessing}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding audio... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <AddAudioIcon className="w-5 h-5" />
                  Add Audio
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

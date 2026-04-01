"use client";

import { useCallback, useState } from "react";
import { VideoCropIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, VideoFileInfo, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { analyzeVideo, type VideoInfo } from "@/lib/video/compress";
import { cropVideo, type CropRegion } from "@/lib/video/crop";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS } from "@/lib/constants";

type AspectKey = "16:9" | "9:16" | "1:1" | "4:3" | "custom";

interface AspectOption {
  label: string;
  desc: string;
  getCrop: (w: number, h: number) => CropRegion;
}

const ASPECT_OPTIONS: Record<AspectKey, AspectOption> = {
  "16:9": {
    label: "16:9",
    desc: "Widescreen",
    getCrop: (w, h) => {
      const targetH = Math.round(w * (9 / 16));
      const cropH = Math.min(targetH, h);
      const cropW = Math.round(cropH * (16 / 9));
      return { left: Math.round((w - cropW) / 2), top: Math.round((h - cropH) / 2), width: cropW, height: cropH };
    },
  },
  "9:16": {
    label: "9:16",
    desc: "Vertical / Stories",
    getCrop: (w, h) => {
      const targetW = Math.round(h * (9 / 16));
      const cropW = Math.min(targetW, w);
      const cropH = Math.round(cropW * (16 / 9));
      return { left: Math.round((w - cropW) / 2), top: Math.round((h - cropH) / 2), width: cropW, height: cropH };
    },
  },
  "1:1": {
    label: "1:1",
    desc: "Square",
    getCrop: (w, h) => {
      const size = Math.min(w, h);
      return { left: Math.round((w - size) / 2), top: Math.round((h - size) / 2), width: size, height: size };
    },
  },
  "4:3": {
    label: "4:3",
    desc: "Classic",
    getCrop: (w, h) => {
      const targetH = Math.round(w * (3 / 4));
      const cropH = Math.min(targetH, h);
      const cropW = Math.round(cropH * (4 / 3));
      return { left: Math.round((w - cropW) / 2), top: Math.round((h - cropH) / 2), width: cropW, height: cropH };
    },
  },
  custom: {
    label: "Custom",
    desc: "Manual crop",
    getCrop: (w, h) => ({ left: 0, top: 0, width: w, height: h }),
  },
};

export default function CropVideoPage() {
  const { isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [aspect, setAspect] = useState<AspectKey>("1:1");
  const [customCrop, setCustomCrop] = useState<CropRegion>({ left: 0, top: 0, width: 0, height: 0 });
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);

  const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
    useFileProcessing();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setFile(files[0]);
      setResult(null);
      clearError();
      try {
        const info = await analyzeVideo(files[0]);
        setVideoInfo(info);
        setCustomCrop({ left: 0, top: 0, width: info.width, height: info.height });
      } catch {
        setError("Could not analyze video.");
      }
    },
    [clearError, setError],
  );

  const processFile = useCallback(async () => {
    if (!file || !videoInfo) return;
    if (!startProcessing()) return;
    setResult(null);

    const crop = aspect === "custom" ? customCrop : ASPECT_OPTIONS[aspect].getCrop(videoInfo.width, videoInfo.height);

    try {
      const r = await cropVideo(file, crop, (p) => setProgress(p * 100));
      setResult(r);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to crop video"));
    } finally {
      stopProcessing();
    }
  }, [file, videoInfo, aspect, customCrop, startProcessing, setProgress, setError, stopProcessing]);

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
    setVideoInfo(null);
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
      sourceToolLabel: "Crop Video",
    });
  }, [result, addToBuffer]);

  // Preview crop dimensions
  const previewCrop = videoInfo
    ? aspect === "custom"
      ? customCrop
      : ASPECT_OPTIONS[aspect].getCrop(videoInfo.width, videoInfo.height)
    : null;

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <VideoPageHeader
        icon={<VideoCropIcon className="w-7 h-7" />}
        iconClass="tool-video-crop"
        title="Crop Video"
        description="Crop video to a specific aspect ratio"
      />

      {result ? (
        <VideoResultView
          blob={result.blob}
          title="Video Cropped!"
          subtitle={`${previewCrop?.width}×${previewCrop?.height}`}
          downloadLabel="Download Video"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Crop Another"
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
          <InfoBox>Crop your video to a specific aspect ratio. Great for social media formats.</InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <VideoFileInfo
            file={file}
            duration={videoInfo?.duration}
            resolution={videoInfo ? `${videoInfo.width}×${videoInfo.height}` : undefined}
            onClear={handleStartOver}
            icon={<VideoToolIcon className="w-5 h-5" />}
          />

          {videoInfo && !isProcessing && (
            <>
              {/* Aspect ratio picker */}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">Aspect Ratio</legend>
                <div className="grid grid-cols-5 gap-2" role="group">
                  {(Object.entries(ASPECT_OPTIONS) as [AspectKey, AspectOption][]).map(([key, opt]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAspect(key)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        aspect === key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Output preview */}
              {previewCrop && (
                <p className="text-sm text-muted-foreground text-center">
                  Output: <span className="font-bold text-foreground">{previewCrop.width}×{previewCrop.height}</span>
                  {" "}from {videoInfo.width}×{videoInfo.height}
                </p>
              )}
            </>
          )}

          {error && <ErrorBox message={error} />}

          <button type="button" onClick={processFile} disabled={isProcessing || !videoInfo} className="btn-primary w-full">
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cropping... {Math.round(progress)}%
              </>
            ) : (
              <>
                <VideoCropIcon className="w-5 h-5" />
                Crop Video
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

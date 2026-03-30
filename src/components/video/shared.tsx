"use client";

import { memo, type ReactNode } from "react";
import { VideoToolIcon } from "@/components/icons/video";
import { FileInfo, PageHeader } from "@/components/shared";
import { formatFileSize } from "@/lib/utils";

// Re-export common components
export { ErrorBox, ProcessButton, SuccessCard, ComparisonDisplay, SavingsBadge, InfoBox } from "@/components/shared";

// ============ Video Page Header ============
interface VideoPageHeaderProps {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export const VideoPageHeader = memo(function VideoPageHeader({
  icon,
  iconClass,
  title,
  description,
}: VideoPageHeaderProps) {
  return (
    <PageHeader
      icon={icon}
      iconClass={iconClass}
      title={title}
      description={description}
      backHref="/"
      backLabel="Back to Video Tools"
      tabKey="video"
    />
  );
});

// ============ Video File Info ============
interface VideoFileInfoProps {
  file: File;
  duration?: number;
  resolution?: string;
  onClear: () => void;
  icon?: ReactNode;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoFileInfo = memo(function VideoFileInfo({
  file,
  duration,
  resolution,
  onClear,
  icon,
}: VideoFileInfoProps) {
  const parts = [formatFileSize(file.size)];
  if (duration && duration > 0) parts.unshift(formatDuration(duration));
  if (resolution) parts.push(resolution);

  return (
    <FileInfo
      file={file}
      fileSize={parts.join(" · ")}
      onClear={onClear}
      icon={icon || <VideoToolIcon className="w-5 h-5 shrink-0" />}
    />
  );
});

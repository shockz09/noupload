"use client";

import type { ReactNode } from "react";
import { AudioIcon, InfoIcon, LoaderIcon, VideoIcon } from "@/components/icons";
import {
	ProgressBar as BaseProgressBar,
	FileInfo,
	PageHeader,
} from "@/components/shared";
import type { ExtractionState } from "@/hooks/useVideoToAudio";
import { formatDuration, formatFileSize } from "@/lib/audio-utils";

// Re-export common components
export { ErrorBox, ProcessButton, SuccessCard } from "@/components/shared";

// ============ FFmpeg Notice (audio-specific) ============
export function FFmpegNotice() {
	return (
		<div className="flex items-start gap-3 p-3 border-2 border-foreground/30 bg-muted/30 text-sm">
			<InfoIcon className="w-5 h-5 shrink-0 mt-0.5" />
			<p className="text-muted-foreground">
				First use downloads the audio engine (~31MB). Subsequent uses are
				instant.
			</p>
		</div>
	);
}

// ============ Audio Progress Bar (converts 0-1 to 0-100) ============
interface ProgressBarProps {
	progress: number; // 0-1 range from FFmpeg
	label: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
	return <BaseProgressBar progress={progress * 100} label={label} />;
}

// ============ Audio Page Header (wrapper) ============
interface AudioPageHeaderProps {
	icon: ReactNode;
	iconClass: string;
	title: string;
	description: string;
}

export function AudioPageHeader({
	icon,
	iconClass,
	title,
	description,
}: AudioPageHeaderProps) {
	return (
		<PageHeader
			icon={icon}
			iconClass={iconClass}
			title={title}
			description={description}
			backHref="/audio"
			backLabel="Back to Audio Tools"
		/>
	);
}

// ============ Audio File Info (with duration support) ============
interface AudioFileInfoProps {
	file: File;
	duration?: number;
	onClear: () => void;
	icon?: ReactNode;
}

export function AudioFileInfo({
	file,
	duration,
	onClear,
	icon,
}: AudioFileInfoProps) {
	const sizeText =
		duration !== undefined && duration > 0
			? `${formatDuration(duration)} • ${formatFileSize(file.size)}`
			: formatFileSize(file.size);

	return (
		<FileInfo
			file={file}
			fileSize={sizeText}
			onClear={onClear}
			icon={icon || <AudioIcon className="w-5 h-5 shrink-0" />}
		/>
	);
}

// ============ Video Extraction Progress ============
interface VideoExtractionProgressProps {
	state: ExtractionState;
	progress: number;
	filename?: string | null;
}

export function VideoExtractionProgress({
	state,
	progress,
	filename,
}: VideoExtractionProgressProps) {
	if (state === "idle") return null;

	const label =
		state === "loading-ffmpeg"
			? "Loading audio engine..."
			: `Extracting audio${filename ? ` from ${filename}` : ""}...`;

	return (
		<div className="p-4 border-2 border-foreground bg-card space-y-3">
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 border-2 border-foreground bg-muted flex items-center justify-center">
					{state === "loading-ffmpeg" ? (
						<LoaderIcon className="w-5 h-5 animate-spin" />
					) : (
						<VideoIcon className="w-5 h-5" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-bold text-sm">{label}</p>
					{filename && state === "extracting" && (
						<p className="text-xs text-muted-foreground truncate">{filename}</p>
					)}
				</div>
			</div>
			{state === "extracting" && (
				<BaseProgressBar
					progress={progress}
					label={`${Math.round(progress)}%`}
				/>
			)}
		</div>
	);
}

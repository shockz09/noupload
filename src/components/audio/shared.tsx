"use client";

import Link from "next/link";
import { InfoIcon, AlertIcon, LoaderIcon, DownloadIcon, ArrowLeftIcon, AudioIcon, CheckIcon } from "@/components/icons";
import { formatFileSize, formatDuration } from "@/lib/audio-utils";

// FFmpeg loading notice - shown when FFmpeg needs to be downloaded
export function FFmpegNotice() {
  return (
    <div className="flex items-start gap-3 p-3 border-2 border-foreground/30 bg-muted/30 text-sm">
      <InfoIcon className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="text-muted-foreground">
        First use downloads the audio engine (~31MB). Subsequent uses are instant.
      </p>
    </div>
  );
}

// Progress bar for audio processing
interface ProgressBarProps {
  progress: number;
  label: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono">{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-2 bg-muted border border-foreground/20">
        <div
          className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// Error message box
interface ErrorBoxProps {
  message: string;
}

export function ErrorBox({ message }: ErrorBoxProps) {
  return (
    <div className="error-box animate-shake">
      <AlertIcon className="w-5 h-5" />
      <span className="font-medium">{message}</span>
    </div>
  );
}

// Processing button with loading state
interface ProcessButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isProcessing: boolean;
  processingLabel: string;
  icon: React.ReactNode;
  label: string;
}

export function ProcessButton({
  onClick,
  disabled,
  isProcessing,
  processingLabel,
  icon,
  label,
}: ProcessButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled || isProcessing} className="btn-primary w-full">
      {isProcessing ? (
        <>
          <LoaderIcon className="w-5 h-5" />
          {processingLabel}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

// Success card for completed operations
interface SuccessCardProps {
  stampText: string;
  title: string;
  subtitle: string;
  downloadLabel: string;
  onDownload: () => void;
  onStartOver: () => void;
  startOverLabel: string;
}

export function SuccessCard({
  stampText,
  title,
  subtitle,
  downloadLabel,
  onDownload,
  onStartOver,
  startOverLabel,
}: SuccessCardProps) {
  return (
    <div className="animate-fade-up">
      <div className="success-card">
        <div className="success-stamp">
          <span className="success-stamp-text">{stampText}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="space-y-4 mb-6">
          <h2 className="text-3xl font-display">{title}</h2>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <button onClick={onDownload} className="btn-success w-full mb-4">
          <DownloadIcon className="w-5 h-5" />
          {downloadLabel}
        </button>
      </div>
      <button onClick={onStartOver} className="btn-secondary w-full mt-4">
        {startOverLabel}
      </button>
    </div>
  );
}

// Audio file info card
interface AudioFileInfoProps {
  file: File;
  duration?: number;
  onClear: () => void;
  icon?: React.ReactNode;
}

export function AudioFileInfo({ file, duration, onClear, icon }: AudioFileInfoProps) {
  return (
    <div className="flex items-center gap-3 p-3 border-2 border-foreground bg-card">
      {icon || <AudioIcon className="w-5 h-5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {duration !== undefined && duration > 0 && `${formatDuration(duration)} • `}
          {formatFileSize(file.size)}
        </p>
      </div>
      <button
        onClick={onClear}
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Change
      </button>
    </div>
  );
}

// Audio page header with back link, icon, title, and description
interface AudioPageHeaderProps {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export function AudioPageHeader({ icon, iconClass, title, description }: AudioPageHeaderProps) {
  return (
    <div className="space-y-6">
      <Link href="/audio" className="back-link">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Audio Tools
      </Link>
      <div className="flex items-center gap-5">
        <div className={`tool-icon ${iconClass}`}>
          {icon}
        </div>
        <div>
          <h1 className="text-4xl font-display">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

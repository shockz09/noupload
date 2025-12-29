import Link from "next/link";
import { ArrowLeftIcon, LoaderIcon, DownloadIcon } from "@/components/icons";
import { ReactNode } from "react";

// ============ Page Header ============
interface ImagePageHeaderProps {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export function ImagePageHeader({ icon, iconClass, title, description }: ImagePageHeaderProps) {
  return (
    <div className="space-y-6">
      <Link href="/image" className="back-link">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Image Tools
      </Link>
      <div className="flex items-center gap-5">
        <div className={`tool-icon ${iconClass}`}>{icon}</div>
        <div>
          <h1 className="text-4xl font-display">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ============ Error Box ============
interface ErrorBoxProps {
  message: string;
}

export function ErrorBox({ message }: ErrorBoxProps) {
  return (
    <div className="error-box animate-shake">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="font-medium">{message}</span>
    </div>
  );
}

// ============ Progress Bar ============
interface ProgressBarProps {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label = "Processing..." }: ProgressBarProps) {
  return (
    <div className="space-y-3">
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        <LoaderIcon className="w-4 h-4" />
        <span>{label}</span>
      </div>
    </div>
  );
}

// ============ Process Button ============
interface ProcessButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isProcessing: boolean;
  processingLabel: string;
  icon: ReactNode;
  label: string;
}

export function ProcessButton({ onClick, disabled, isProcessing, processingLabel, icon, label }: ProcessButtonProps) {
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

// ============ Success Card ============
interface SuccessCardProps {
  stampText: string;
  title: string;
  children?: ReactNode;
  downloadLabel: string;
  onDownload: (e: React.MouseEvent) => void;
  onStartOver: () => void;
  startOverLabel: string;
}

export function SuccessCard({ stampText, title, children, downloadLabel, onDownload, onStartOver, startOverLabel }: SuccessCardProps) {
  return (
    <div className="animate-fade-up">
      <div className="success-card">
        <div className="success-stamp">
          <span className="success-stamp-text">{stampText}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="text-3xl font-display">{title}</h2>
          {children}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button type="button" onClick={onDownload} className="btn-success flex-1">
            <DownloadIcon className="w-5 h-5" />
            {downloadLabel}
          </button>
          <button type="button" onClick={onStartOver} className="btn-secondary flex-1">
            {startOverLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Image File Info ============
interface ImageFileInfoProps {
  file: File;
  fileSize: string;
  onClear: () => void;
  icon?: ReactNode;
}

export function ImageFileInfo({ file, fileSize, onClear, icon }: ImageFileInfoProps) {
  return (
    <div className="file-item">
      <div className="pdf-icon-box">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{file.name}</p>
        <p className="text-sm text-muted-foreground">{fileSize}</p>
      </div>
      <button
        onClick={onClear}
        className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Change file
      </button>
    </div>
  );
}

// ============ Comparison Display ============
interface ComparisonDisplayProps {
  originalLabel: string;
  originalValue: string;
  newLabel: string;
  newValue: string;
}

export function ComparisonDisplay({ originalLabel, originalValue, newLabel, newValue }: ComparisonDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{originalLabel}</p>
        <p className="text-xl font-bold">{originalValue}</p>
      </div>
      <div className="w-12 h-12 flex items-center justify-center bg-foreground text-background">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{newLabel}</p>
        <p className="text-xl font-bold">{newValue}</p>
      </div>
    </div>
  );
}

// ============ Savings Badge ============
interface SavingsBadgeProps {
  savings: number;
}

export function SavingsBadge({ savings }: SavingsBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 border-2 font-bold text-sm ${
      savings > 0
        ? "bg-[#2D5A3D] text-white border-foreground"
        : "bg-muted text-muted-foreground border-border"
    }`}>
      {savings > 0 ? (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="17 11 12 6 7 11" />
            <path d="M12 6v12" />
          </svg>
          {savings}% smaller
        </>
      ) : (
        "Already optimized"
      )}
    </div>
  );
}

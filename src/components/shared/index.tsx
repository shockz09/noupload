import Link from "next/link";
import type { ReactNode } from "react";
import {
	AlertIcon,
	ArrowLeftIcon,
	CopyIcon,
	DownloadIcon,
	LoaderIcon,
} from "@/components/icons";

// ============ Page Header ============
interface PageHeaderProps {
	icon: ReactNode;
	iconClass: string;
	title: string;
	description: string;
	backHref: string;
	backLabel: string;
}

export function PageHeader({
	icon,
	iconClass,
	title,
	description,
	backHref,
	backLabel,
}: PageHeaderProps) {
	return (
		<div className="space-y-6">
			<Link href={backHref} className="back-link">
				<ArrowLeftIcon className="w-4 h-4" />
				{backLabel}
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
			<AlertIcon className="w-5 h-5" />
			<span className="font-medium">{message}</span>
		</div>
	);
}

// ============ Progress Bar ============
interface ProgressBarProps {
	progress: number;
	label?: string;
}

export function ProgressBar({
	progress,
	label = "Processing...",
}: ProgressBarProps) {
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

export function ProcessButton({
	onClick,
	disabled,
	isProcessing,
	processingLabel,
	icon,
	label,
}: ProcessButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || isProcessing}
			className="btn-primary w-full"
		>
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
	subtitle?: string; // Simple text subtitle
	children?: ReactNode; // Custom content
	downloadLabel: string;
	onDownload: (e: React.MouseEvent) => void;
	onCopy?: () => void; // Optional copy to clipboard
	onStartOver: () => void;
	startOverLabel: string;
}

export function SuccessCard({
	stampText,
	title,
	subtitle,
	children,
	downloadLabel,
	onDownload,
	onCopy,
	onStartOver,
	startOverLabel,
}: SuccessCardProps) {
	return (
		<div className="animate-fade-up">
			<div className="success-card">
				<div className="success-stamp">
					<span className="success-stamp-text">{stampText}</span>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>

				<div className="space-y-4 mb-8">
					<h2 className="text-3xl font-display">{title}</h2>
					{subtitle && <p className="text-muted-foreground">{subtitle}</p>}
					{children}
				</div>

				<div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
					<div className="flex gap-2">
						<button type="button" onClick={onDownload} className="btn-success">
							<DownloadIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
							{downloadLabel}
						</button>
						{onCopy && (
							<button
								type="button"
								onClick={onCopy}
								className="btn-success px-2 sm:px-3 shrink-0"
								title="Copy to clipboard"
							>
								<CopyIcon className="w-4 h-4 sm:w-5 sm:h-5" />
							</button>
						)}
					</div>
					<button type="button" onClick={onStartOver} className="btn-secondary">
						{startOverLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

// ============ File Info ============
interface FileInfoProps {
	file: File;
	fileSize: string;
	onClear: () => void;
	icon?: ReactNode;
}

export function FileInfo({ file, fileSize, onClear, icon }: FileInfoProps) {
	return (
		<div className="file-item">
			<div className="pdf-icon-box">{icon}</div>
			<div className="flex-1 min-w-0">
				<p className="font-bold truncate">{file.name}</p>
				{fileSize && (
					<p className="text-sm text-muted-foreground">{fileSize}</p>
				)}
			</div>
			<button
				type="button"
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

export function ComparisonDisplay({
	originalLabel,
	originalValue,
	newLabel,
	newValue,
}: ComparisonDisplayProps) {
	return (
		<div className="flex items-center justify-center gap-6">
			<div className="text-center">
				<p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
					{originalLabel}
				</p>
				<p className="text-xl font-bold">{originalValue}</p>
			</div>
			<div className="w-12 h-12 flex items-center justify-center bg-foreground text-background">
				<svg
					aria-hidden="true"
					className="w-5 h-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
				>
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</div>
			<div className="text-center">
				<p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
					{newLabel}
				</p>
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
		<div
			className={`inline-flex items-center gap-2 px-4 py-2 border-2 font-bold text-sm ${
				savings > 0
					? "bg-[#2D5A3D] text-white border-foreground"
					: "bg-muted text-muted-foreground border-border"
			}`}
		>
			{savings > 0 ? (
				<>
					<svg
						aria-hidden="true"
						className="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
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

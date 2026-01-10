"use client";

import { useCallback, useState, useMemo, memo } from "react";
import { UploadIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
	accept?: string;
	multiple?: boolean;
	onFilesSelected: (files: File[]) => void;
	maxFiles?: number;
	maxSize?: number;
	className?: string;
	title?: string;
	subtitle?: string;
	compact?: boolean;
}

export const FileDropzone = memo(function FileDropzone({
	accept = ".pdf",
	multiple = true,
	onFilesSelected,
	maxFiles = 50,
	maxSize = 100 * 1024 * 1024,
	className,
	title,
	subtitle,
	compact = false,
}: FileDropzoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Memoize accepted extensions parsing
	const acceptedExtensions = useMemo(
		() => accept.split(",").map((a) => a.trim().toLowerCase()),
		[accept]
	);

	const handleFiles = useCallback(
		(files: FileList | null) => {
			if (!files) return;

			setError(null);
			const fileArray = Array.from(files);

			if (fileArray.length > maxFiles) {
				setError(`Maximum ${maxFiles} files allowed`);
				return;
			}

			const oversized = fileArray.find((f) => f.size > maxSize);
			if (oversized) {
				setError(
					`File "${oversized.name}" exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`,
				);
				return;
			}

			const validFiles = fileArray.filter((f) => {
				const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
				return acceptedExtensions.some((a) => a === ext || a === f.type);
			});

			if (validFiles.length !== fileArray.length) {
				setError(`Some files were skipped. Only ${accept} files are accepted.`);
			}

			if (validFiles.length > 0) {
				onFilesSelected(validFiles);
			}
		},
		[accept, acceptedExtensions, maxFiles, maxSize, onFilesSelected],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			handleFiles(e.dataTransfer.files);
		},
		[handleFiles],
	);

	const handleClick = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.multiple = multiple;
		input.onchange = (e) => {
			const target = e.target as HTMLInputElement;
			handleFiles(target.files);
		};
		input.click();
	}, [accept, multiple, handleFiles]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleClick();
		}
	}, [handleClick]);

	// Memoize display label
	const acceptLabel = useMemo(
		() => accept.split(",").map((a) => a.trim().toUpperCase().replace(".", "")).join(", "),
		[accept]
	);

	if (compact) {
		return (
			<div
				role="button"
				tabIndex={0}
				className={cn(
					"border-2 border-dashed border-muted-foreground/40 p-4 text-center cursor-pointer hover:border-foreground hover:bg-muted/30 transition-colors",
					isDragging && "border-foreground bg-muted/30",
					className,
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
			>
				<div className="flex items-center justify-center gap-2 text-muted-foreground">
					<UploadIcon className="w-5 h-5" />
					<span className="text-sm font-bold">
						{isDragging ? "Drop here" : title || "Add more files"}
					</span>
					{subtitle && <span className="text-xs">({subtitle})</span>}
				</div>
				{error && (
					<p className="text-xs text-red-500 mt-2">{error}</p>
				)}
			</div>
		);
	}

	return (
		<div
			role="button"
			tabIndex={0}
			className={cn(
				"dropzone relative cursor-pointer",
				isDragging && "dragging dropzone-active",
				className,
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			<div className="relative z-10 space-y-5">
				{/* Upload Icon */}
				<div className="upload-icon">
					<UploadIcon className="w-8 h-8" />
				</div>

				{/* Text */}
				<div className="space-y-2">
					<p className="text-xl font-bold text-foreground">
						{isDragging
							? "Drop it like it's hot"
							: title || "Drop your files here"}
					</p>
					<p className="text-muted-foreground">
						{subtitle || "or click to browse from your device"}
					</p>
				</div>

				{/* CTA Button */}
				<button
					type="button"
					className="inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background font-bold text-sm border-2 border-foreground hover:bg-primary hover:border-primary transition-colors"
				>
					<svg
						aria-hidden="true"
						className="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
					Select Files
				</button>

				{/* File info */}
				<p className="text-xs text-muted-foreground font-medium pt-2">
					{acceptLabel} files • Max {Math.round(maxSize / 1024 / 1024)}MB
					{multiple && ` • Up to ${maxFiles} files`}
				</p>

				{/* Error */}
				{error && (
					<div className="error-box mt-4 justify-center">
						<svg
							aria-hidden="true"
							className="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<span className="text-sm font-medium">{error}</span>
					</div>
				)}
			</div>
		</div>
	);
});

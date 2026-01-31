"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { getPdfjsWorkerSrc } from "@/lib/pdfjs-config";

interface PageThumbnail {
	pageNumber: number;
	dataUrl: string;
	width: number;
	height: number;
}

export function usePdfPages(file: File | null, scale: number = 0.5) {
	const [pages, setPages] = useState<PageThumbnail[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		// Revoke previous blob URLs to prevent memory leaks
		pages.forEach((page) => {
			if (page.dataUrl.startsWith("blob:")) {
				URL.revokeObjectURL(page.dataUrl);
			}
		});

		if (!file) {
			setPages([]);
			return;
		}

		let cancelled = false;

		async function loadPages() {
			setLoading(true);
			setError(null);
			setProgress(0);

			try {
				const pdfjsLib = await import("pdfjs-dist");
				pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc(pdfjsLib.version);

				if (!file) return;
				const arrayBuffer = await file.arrayBuffer();
				const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
				const totalPages = pdf.numPages;
				const loadedPages: PageThumbnail[] = [];

				for (let i = 1; i <= totalPages; i++) {
					if (cancelled) return;

					const page = await pdf.getPage(i);
					const viewport = page.getViewport({ scale });

					const canvas = document.createElement("canvas");
					canvas.width = viewport.width;
					canvas.height = viewport.height;

					const context = canvas.getContext("2d")!;
					await page.render({ canvasContext: context, viewport, canvas })
						.promise;

					// Use toBlob instead of toDataURL (33% smaller, non-blocking)
					const blob = await new Promise<Blob>((resolve) => {
						canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8);
					});

					loadedPages.push({
						pageNumber: i,
						dataUrl: URL.createObjectURL(blob),
						width: viewport.width,
						height: viewport.height,
					});

					// Clean up canvas to free memory
					canvas.width = 0;
					canvas.height = 0;

					setProgress(Math.round((i / totalPages) * 100));
				}

				if (!cancelled) {
					setPages(loadedPages);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load PDF");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadPages();

		return () => {
			cancelled = true;
		};
	}, [file, scale]);

	return { pages, loading, error, progress };
}

// Thumbnail component for a single page (memoized for list rendering performance)
interface PageThumbnailCardProps {
	page: PageThumbnail;
	selected?: boolean;
	onClick?: () => void;
	rotation?: number;
	overlay?: React.ReactNode;
	badge?: React.ReactNode;
	className?: string;
}

export const PageThumbnailCard = memo(function PageThumbnailCard({
	page,
	selected = false,
	onClick,
	rotation = 0,
	overlay,
	badge,
	className = "",
}: PageThumbnailCardProps) {
	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (onClick && (e.key === "Enter" || e.key === " ")) {
			e.preventDefault();
			onClick();
		}
	}, [onClick]);

	return (
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={onClick ? handleKeyDown : undefined}
			className={`
        relative group cursor-pointer transition-all duration-200
        ${selected ? "ring-4 ring-primary ring-offset-2" : ""}
        ${onClick ? "hover:scale-[1.02]" : ""}
        ${className}
      `}
		>
			{/* Page container */}
			<div className="relative bg-white border-2 border-foreground overflow-hidden">
				{/* Page number badge */}
				<div className="absolute top-2 left-2 z-10 file-number text-xs">
					{page.pageNumber}
				</div>

				{/* Custom badge (e.g., rotation indicator) */}
				{badge && <div className="absolute top-2 right-2 z-10">{badge}</div>}

				{/* Image */}
				<div
					className="transition-transform duration-300"
					style={{ transform: `rotate(${rotation}deg)` }}
				>
					<img
						src={page.dataUrl}
						alt={`Page ${page.pageNumber}`}
						className="w-full h-auto block"
						draggable={false}
						loading="lazy"
						decoding="async"
					/>
				</div>

				{/* Overlay (e.g., watermark preview) */}
				{overlay && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						{overlay}
					</div>
				)}

				{/* Hover effect */}
				{onClick && (
					<div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
				)}
			</div>

			{/* Selection indicator */}
			{selected && (
				<div className="absolute -top-1 -right-1 w-6 h-6 bg-primary border-2 border-foreground flex items-center justify-center">
					<svg
						aria-hidden="true"
						className="w-4 h-4 text-white"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
			)}
		</div>
	);
});

// Grid of page thumbnails
interface PageGridProps {
	pages: PageThumbnail[];
	selectedPages?: number[];
	onPageClick?: (pageNumber: number) => void;
	rotations?: Record<number, number>;
	overlayRenderer?: (page: PageThumbnail) => React.ReactNode;
	badgeRenderer?: (page: PageThumbnail) => React.ReactNode;
	columns?: number;
}

export const PageGrid = memo(function PageGrid({
	pages,
	selectedPages = [],
	onPageClick,
	rotations = {},
	overlayRenderer,
	badgeRenderer,
	columns = 4,
}: PageGridProps) {
	return (
		<div
			className="grid gap-4"
			style={{
				gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
			}}
		>
			{pages.map((page) => (
				<PageThumbnailCard
					key={page.pageNumber}
					page={page}
					selected={selectedPages.includes(page.pageNumber)}
					onClick={onPageClick ? () => onPageClick(page.pageNumber) : undefined}
					rotation={rotations[page.pageNumber] || 0}
					overlay={overlayRenderer?.(page)}
					badge={badgeRenderer?.(page)}
				/>
			))}
		</div>
	);
});

// Loading state component
export const PageGridLoading = memo(function PageGridLoading({
	progress,
}: { progress: number }) {
	return (
		<div className="py-12 text-center space-y-4">
			<div className="inline-flex items-center justify-center w-16 h-16 bg-primary text-white border-2 border-foreground">
				<svg
					aria-hidden="true"
					className="w-8 h-8 animate-spin"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
			</div>
			<div className="space-y-2">
				<p className="font-bold text-foreground">Loading PDF pages...</p>
				<div className="progress-bar max-w-xs mx-auto">
					<div
						className="progress-bar-fill"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<p className="text-sm text-muted-foreground">{progress}%</p>
			</div>
		</div>
	);
});

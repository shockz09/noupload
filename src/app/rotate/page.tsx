"use client";

import { useCallback, useState } from "react";
import { LoaderIcon, RotateIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	PageGridLoading,
	PageThumbnailCard,
	usePdfPages,
} from "@/components/pdf/pdf-page-preview";
import {
	ErrorBox,
	PdfPageHeader,
	ProgressBar,
	SuccessCard,
} from "@/components/pdf/shared";
import { downloadBlob, rotatePDF } from "@/lib/pdf-utils";

interface RotateResult {
	data: Uint8Array;
	filename: string;
}

export default function RotatePage() {
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<RotateResult | null>(null);

	// Per-page rotations
	const [pageRotations, setPageRotations] = useState<Record<number, number>>(
		{},
	);

	const { pages, loading, progress } = usePdfPages(file, 0.4);

	const handleFileSelected = useCallback((files: File[]) => {
		if (files.length > 0) {
			setFile(files[0]);
			setError(null);
			setResult(null);
			setPageRotations({});
		}
	}, []);

	const handleClear = useCallback(() => {
		setFile(null);
		setError(null);
		setResult(null);
		setPageRotations({});
	}, []);

	// Rotate a single page by 90 degrees
	const rotatePage = (pageNumber: number) => {
		setPageRotations((prev) => {
			const current = prev[pageNumber] || 0;
			const next = (current + 90) % 360;
			return { ...prev, [pageNumber]: next };
		});
	};

	// Rotate all pages by 90 degrees
	const rotateAll = (direction: 90 | -90) => {
		setPageRotations((prev) => {
			const newRotations: Record<number, number> = {};
			pages.forEach((page) => {
				const current = prev[page.pageNumber] || 0;
				const next = (current + direction + 360) % 360;
				newRotations[page.pageNumber] = next;
			});
			return newRotations;
		});
	};

	// Reset all rotations
	const resetAll = () => {
		setPageRotations({});
	};

	const handleRotate = async () => {
		if (!file) return;

		// Check if any pages have rotation
		const hasRotations = Object.values(pageRotations).some((r) => r !== 0);
		if (!hasRotations) {
			setError("Click on pages to rotate them first");
			return;
		}

		setIsProcessing(true);
		setError(null);
		setResult(null);

		try {
			// We need to apply rotations page by page
			// For simplicity, we'll apply each unique rotation separately
			const _currentData = await file.arrayBuffer();
			let currentFile = file;

			// Group pages by rotation
			const rotationGroups: Record<number, number[]> = {};
			Object.entries(pageRotations).forEach(([page, rotation]) => {
				if (rotation !== 0) {
					if (!rotationGroups[rotation]) {
						rotationGroups[rotation] = [];
					}
					rotationGroups[rotation].push(parseInt(page, 10));
				}
			});

			// Apply each rotation group
			for (const [rotation, pageNumbers] of Object.entries(rotationGroups)) {
				const rotated = await rotatePDF(
					currentFile,
					parseInt(rotation, 10) as 0 | 90 | 180 | 270,
					pageNumbers,
				);
				currentFile = new File([new Uint8Array(rotated)], file.name, {
					type: "application/pdf",
				});
			}

			// Get final result
			const finalData = new Uint8Array(await currentFile.arrayBuffer());
			const baseName = file.name.replace(".pdf", "");

			setResult({
				data: finalData,
				filename: `${baseName}_rotated.pdf`,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to rotate PDF");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownload = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (result) {
			downloadBlob(result.data, result.filename);
		}
	};

	const handleStartOver = () => {
		setFile(null);
		setResult(null);
		setError(null);
		setPageRotations({});
	};

	const rotatedCount = Object.values(pageRotations).filter(
		(r) => r !== 0,
	).length;

	return (
		<div className="page-enter max-w-5xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<RotateIcon className="w-7 h-7" />}
				iconClass="tool-rotate"
				title="Rotate PDF"
				description="Click on pages to rotate them individually"
			/>

			{result ? (
				<div className="max-w-2xl mx-auto">
					<SuccessCard
						stampText="Complete"
						title="PDF Rotated!"
						downloadLabel="Download PDF"
						onDownload={handleDownload}
						onStartOver={handleStartOver}
						startOverLabel="Rotate Another PDF"
					>
						<p className="text-muted-foreground">
							{rotatedCount} {rotatedCount === 1 ? "page" : "pages"} rotated
							successfully
						</p>
					</SuccessCard>
				</div>
			) : !file ? (
				<div className="max-w-2xl mx-auto">
					<FileDropzone
						accept=".pdf"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your PDF file here"
					/>
				</div>
			) : (
				<div className="space-y-6">
					{/* Toolbar */}
					<div className="p-4 bg-card border-2 border-foreground space-y-4">
						{/* Top row: page count and change file */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="font-bold">{pages.length} pages</span>
								{rotatedCount > 0 && (
									<span className="px-3 py-1 bg-primary text-white text-sm font-bold border-2 border-foreground">
										{rotatedCount} rotated
									</span>
								)}
							</div>
							<button
								type="button"
								onClick={handleClear}
								className="px-3 py-1.5 text-muted-foreground font-semibold text-sm hover:text-foreground transition-colors whitespace-nowrap"
							>
								Change file
							</button>
						</div>

						{/* Bottom row: action buttons */}
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => rotateAll(90)}
								className="flex-1 px-3 py-2.5 sm:px-4 bg-muted border-2 border-foreground font-bold text-sm hover:bg-accent transition-colors flex items-center justify-center gap-1.5 sm:gap-2"
							>
								<svg
									aria-hidden="true"
									className="w-4 h-4 shrink-0"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
									<path d="M21 3v5h-5" />
								</svg>
								All →
							</button>
							<button
								type="button"
								onClick={() => rotateAll(-90)}
								className="flex-1 px-3 py-2.5 sm:px-4 bg-muted border-2 border-foreground font-bold text-sm hover:bg-accent transition-colors flex items-center justify-center gap-1.5 sm:gap-2"
							>
								<svg
									aria-hidden="true"
									className="w-4 h-4 shrink-0 -scale-x-100"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
									<path d="M21 3v5h-5" />
								</svg>
								← All
							</button>
							{rotatedCount > 0 && (
								<button
									type="button"
									onClick={resetAll}
									className="flex-1 px-3 py-2.5 sm:px-4 bg-muted border-2 border-foreground font-bold text-sm hover:bg-destructive hover:text-white transition-colors"
								>
									Reset
								</button>
							)}
						</div>
					</div>

					{/* Page Grid */}
					{loading ? (
						<PageGridLoading progress={progress} />
					) : (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{pages.map((page) => {
								const rotation = pageRotations[page.pageNumber] || 0;
								return (
									<PageThumbnailCard
										key={page.pageNumber}
										page={page}
										onClick={() => rotatePage(page.pageNumber)}
										rotation={rotation}
										badge={
											rotation !== 0 ? (
												<div className="px-2 py-1 bg-primary text-white text-xs font-bold border-2 border-foreground">
													{rotation}°
												</div>
											) : null
										}
									/>
								);
							})}
						</div>
					)}

					{/* Help text */}
					<div className="info-box">
						<svg
							aria-hidden="true"
							className="w-5 h-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 16v-4" />
							<path d="M12 8h.01" />
						</svg>
						<span className="text-sm">
							<strong>Tip:</strong> Click on any page to rotate it 90°
							clockwise. Click multiple times for 180° or 270°.
						</span>
					</div>

					{error && <ErrorBox message={error} />}
					{isProcessing && (
						<ProgressBar progress={50} label="Applying rotations..." />
					)}

					{/* Action Button */}
					<button
						type="button"
						onClick={handleRotate}
						disabled={isProcessing || rotatedCount === 0}
						className="btn-primary w-full max-w-md mx-auto block"
					>
						{isProcessing ? (
							<>
								<LoaderIcon className="w-5 h-5" />
								Rotating...
							</>
						) : (
							<>
								<RotateIcon className="w-5 h-5" />
								Apply Rotation
								{rotatedCount > 0 ? ` (${rotatedCount} pages)` : ""}
							</>
						)}
					</button>
				</div>
			)}
		</div>
	);
}

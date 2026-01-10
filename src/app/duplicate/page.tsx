"use client";

import { useCallback, useMemo, useRef, useState, memo } from "react";
import {
	DownloadIcon,
	DuplicateIcon,
	LoaderIcon,
	PdfIcon,
} from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages } from "@/components/pdf/pdf-page-preview";
import { ErrorBox, PdfFileInfo, PdfPageHeader } from "@/components/pdf/shared";
import { useFileProcessing } from "@/hooks";
import { downloadBlob, extractPagesWithRotation } from "@/lib/pdf-utils";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

const PlusIcon = memo(function PlusIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
});

const XIcon = memo(function XIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
});

const GripIcon = memo(function GripIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<circle cx="9" cy="6" r="1" fill="currentColor" />
			<circle cx="15" cy="6" r="1" fill="currentColor" />
			<circle cx="9" cy="12" r="1" fill="currentColor" />
			<circle cx="15" cy="12" r="1" fill="currentColor" />
			<circle cx="9" cy="18" r="1" fill="currentColor" />
			<circle cx="15" cy="18" r="1" fill="currentColor" />
		</svg>
	);
});

const RotateIcon = memo(function RotateIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
			<path d="M21 3v5h-5" />
		</svg>
	);
});

interface PageItem {
	id: string;
	pageNumber: number; // Original page number (1-indexed)
	isDuplicate: boolean;
	rotation: 0 | 90 | 180 | 270;
}

export default function DuplicatePage() {
	const [file, setFile] = useState<File | null>(null);
	const [pageItems, setPageItems] = useState<PageItem[]>([]);
	const [draggedId, setDraggedId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);

	// Use custom hook for processing state
	const { isProcessing, error, startProcessing, stopProcessing, setError, clearError } = useFileProcessing();

	const { pages, loading: pagesLoading } = usePdfPages(file, 0.3);

	// Initialize page items when pages load
	const handleFileSelected = useCallback((files: File[]) => {
		if (files.length > 0) {
			setFile(files[0]);
			clearError();
			setPageItems([]);
		}
	}, [clearError]);

	// Update page items when pages change
	if (pages.length > 0 && pageItems.length === 0) {
		setPageItems(
			pages.map((p) => ({
				id: `page-${p.pageNumber}`,
				pageNumber: p.pageNumber,
				isDuplicate: false,
				rotation: 0,
			})),
		);
	}

	const handleClear = useCallback(() => {
		setFile(null);
		clearError();
		setPageItems([]);
	}, [clearError]);

	const duplicatePage = useCallback((afterId: string) => {
		setPageItems((prev) => {
			const index = prev.findIndex((p) => p.id === afterId);
			if (index === -1) return prev;

			const item = prev[index];
			const newItem: PageItem = {
				id: `dup-${item.pageNumber}-${Date.now()}`,
				pageNumber: item.pageNumber,
				isDuplicate: true,
				rotation: item.rotation,
			};

			const newItems = [...prev];
			newItems.splice(index + 1, 0, newItem);
			return newItems;
		});
	}, []);

	const rotatePage = useCallback((id: string) => {
		setPageItems((prev) =>
			prev.map((p) =>
				p.id === id
					? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 }
					: p,
			),
		);
	}, []);

	const removePage = useCallback((id: string) => {
		setPageItems((prev) => prev.filter((p) => p.id !== id));
	}, []);

	// Use ref for draggedId to avoid stale closures in drag handlers
	const draggedIdRef = useRef(draggedId);
	draggedIdRef.current = draggedId;

	// Drag and drop handlers
	const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
		setDraggedId(id);
		e.dataTransfer.effectAllowed = "move";
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
		e.preventDefault();
		if (draggedIdRef.current && draggedIdRef.current !== id) {
			setDragOverId(id);
		}
	}, []);

	const handleDragLeave = useCallback(() => {
		setDragOverId(null);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		const currentDraggedId = draggedIdRef.current;
		if (!currentDraggedId || currentDraggedId === targetId) {
			setDraggedId(null);
			setDragOverId(null);
			return;
		}

		setPageItems((prev) => {
			const dragIndex = prev.findIndex((p) => p.id === currentDraggedId);
			const dropIndex = prev.findIndex((p) => p.id === targetId);

			if (dragIndex === -1 || dropIndex === -1) return prev;

			const newItems = [...prev];
			const [removed] = newItems.splice(dragIndex, 1);
			newItems.splice(dropIndex, 0, removed);
			return newItems;
		});

		setDraggedId(null);
		setDragOverId(null);
	}, []);

	const handleDragEnd = useCallback(() => {
		setDraggedId(null);
		setDragOverId(null);
	}, []);

	const handleDownload = useCallback(async () => {
		if (!file || pageItems.length === 0) return;
		if (!startProcessing()) return;

		try {
			const pageSpecs = pageItems.map((p) => ({
				pageNumber: p.pageNumber,
				rotation: p.rotation,
			}));
			const data = await extractPagesWithRotation(file, pageSpecs);

			const baseName = getFileBaseName(file.name);
			const hasDuplicates = pageItems.some((p) => p.isDuplicate);
			const hasRotations = pageItems.some((p) => p.rotation !== 0);
			let suffix = "_modified";
			if (hasDuplicates && hasRotations) suffix = "_edited";
			else if (hasDuplicates) suffix = "_duplicated";
			else if (hasRotations) suffix = "_rotated";

			downloadBlob(data, `${baseName}${suffix}.pdf`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to process PDF");
		} finally {
			stopProcessing();
		}
	}, [file, pageItems, startProcessing, setError, stopProcessing]);

	const duplicateCount = useMemo(() => pageItems.filter((p) => p.isDuplicate).length, [pageItems]);
	const rotatedCount = useMemo(() => pageItems.filter((p) => p.rotation !== 0).length, [pageItems]);
	const hasChanges = useMemo(() =>
		duplicateCount > 0 ||
		rotatedCount > 0 ||
		pageItems.some((p, i) => p.pageNumber !== i + 1),
	[duplicateCount, rotatedCount, pageItems]);

	const getPagePreview = useCallback((pageNumber: number) => {
		const page = pages.find((p) => p.pageNumber === pageNumber);
		return page?.dataUrl || "";
	}, [pages]);

	// Reset handler
	const handleReset = useCallback(() => {
		setPageItems(
			pages.map((p) => ({
				id: `page-${p.pageNumber}`,
				pageNumber: p.pageNumber,
				isDuplicate: false,
				rotation: 0,
			})),
		);
	}, [pages]);

	return (
		<div className="page-enter max-w-4xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<DuplicateIcon className="w-7 h-7" />}
				iconClass="tool-duplicate"
				title="Duplicate Pages"
				description="Duplicate and reorder pages in your PDF"
			/>

			{!file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".pdf"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your PDF file here"
					/>

					<div className="border-2 border-foreground/30 p-4">
						<div className="flex items-center gap-2 mb-3">
							<div className="w-1.5 h-4 bg-foreground" />
							<span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
								How it works
							</span>
						</div>
						<div className="grid sm:grid-cols-3 gap-4 text-sm">
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
									1
								</div>
								<div>
									<p className="font-bold">Upload PDF</p>
									<p className="text-muted-foreground text-xs">See all pages</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
									2
								</div>
								<div>
									<p className="font-bold">Duplicate</p>
									<p className="text-muted-foreground text-xs">
										Click + to copy a page
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
									3
								</div>
								<div>
									<p className="font-bold">Reorder</p>
									<p className="text-muted-foreground text-xs">
										Drag pages to arrange
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="space-y-6">
					<PdfFileInfo
						file={file}
						fileSize={formatFileSize(file.size)}
						onClear={handleClear}
						icon={<PdfIcon className="w-5 h-5" />}
					/>

					{pagesLoading ? (
						<div className="border-2 border-foreground bg-card p-12 text-center">
							<LoaderIcon className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
							<p className="text-muted-foreground font-medium">
								Loading pages...
							</p>
						</div>
					) : (
						<>
							{/* Stats bar */}
							<div className="flex items-center justify-between p-3 border-2 border-foreground/30 bg-muted/30">
								<div className="flex items-center gap-3 text-sm flex-wrap">
									<span>
										<span className="font-bold">{pages.length}</span> original
									</span>
									{duplicateCount > 0 && (
										<>
											<span className="text-muted-foreground">·</span>
											<span className="text-primary font-bold">
												{duplicateCount} copied
											</span>
										</>
									)}
									{rotatedCount > 0 && (
										<>
											<span className="text-muted-foreground">·</span>
											<span className="font-bold">{rotatedCount} rotated</span>
										</>
									)}
									<span className="text-muted-foreground">=</span>
									<span className="font-bold">{pageItems.length} total</span>
								</div>
								{hasChanges && (
									<button
										type="button"
										onClick={handleReset}
										className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
									>
										Reset
									</button>
								)}
							</div>

							{/* Page grid */}
							<div className="border-2 border-foreground bg-card p-4">
								<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
									{pageItems.map((item, index) => (
										<div
											key={item.id}
											draggable
											onDragStart={(e) => handleDragStart(e, item.id)}
											onDragOver={(e) => handleDragOver(e, item.id)}
											onDragLeave={handleDragLeave}
											onDrop={(e) => handleDrop(e, item.id)}
											onDragEnd={handleDragEnd}
											className={`group relative transition-all ${
												draggedId === item.id ? "opacity-50" : ""
											} ${dragOverId === item.id ? "scale-105" : ""}`}
										>
											{/* Drop indicator */}
											{dragOverId === item.id && (
												<div className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full" />
											)}

											<div
												className={`relative border-2 overflow-hidden cursor-grab active:cursor-grabbing ${
													item.isDuplicate
														? "border-primary bg-primary/5"
														: "border-foreground/30 hover:border-foreground"
												}`}
											>
												{/* Page preview */}
												<div className="aspect-[3/4] bg-white overflow-hidden">
													<img
														src={getPagePreview(item.pageNumber)}
														alt={`Page ${item.pageNumber}`}
														className="w-full h-full object-contain transition-transform"
														style={{ transform: `rotate(${item.rotation}deg)` }}
														draggable={false}
														loading="lazy"
														decoding="async"
													/>
												</div>

												{/* Grip handle */}
												<div className="absolute top-1 left-1 p-1 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity">
													<GripIcon className="w-3 h-3 text-white" />
												</div>

												{/* Rotate button */}
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														rotatePage(item.id);
													}}
													className="absolute top-1 left-7 p-1 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
													title="Rotate 90°"
												>
													<RotateIcon className="w-3 h-3 text-white" />
												</button>

												{/* Duplicate badge */}
												{item.isDuplicate && (
													<div className="absolute top-1 right-1 px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold">
														COPY
													</div>
												)}

												{/* Bottom bar */}
												<div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs py-1 px-2 flex items-center justify-between">
													<span className="font-mono">{index + 1}</span>
													<span className="text-white/60 text-[10px]">
														pg {item.pageNumber}
													</span>
												</div>

												{/* Remove button for duplicates */}
												{item.isDuplicate && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															removePage(item.id);
														}}
														className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
														style={{ top: item.isDuplicate ? "24px" : "4px" }}
													>
														<XIcon className="w-3 h-3" />
													</button>
												)}
											</div>

											{/* Duplicate button */}
											<button
												type="button"
												onClick={() => duplicatePage(item.id)}
												className="absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
												title="Duplicate this page"
											>
												<PlusIcon className="w-4 h-4" />
											</button>
										</div>
									))}
								</div>
							</div>

							{error && <ErrorBox message={error} />}

							{/* Download button */}
							<button
								type="button"
								onClick={handleDownload}
								disabled={isProcessing || !hasChanges}
								className="btn-success w-full"
							>
								{isProcessing ? (
									<>
										<LoaderIcon className="w-5 h-5" />
										Processing...
									</>
								) : (
									<>
										<DownloadIcon className="w-5 h-5" />
										Download PDF ({pageItems.length} pages)
									</>
								)}
							</button>

							{!hasChanges && (
								<p className="text-center text-sm text-muted-foreground">
									Click <span className="font-bold">+</span> on a page to
									duplicate it, or drag pages to reorder
								</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

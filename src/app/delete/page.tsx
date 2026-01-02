"use client";

import { useCallback, useRef, useState } from "react";
import {
	DeletePagesIcon,
	DownloadIcon,
	LoaderIcon,
	PdfIcon,
} from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { usePdfPages } from "@/components/pdf/pdf-page-preview";
import { ErrorBox, PdfFileInfo, PdfPageHeader } from "@/components/pdf/shared";
import { downloadBlob, extractPagesWithRotation } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";

function XIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

function GripIcon({ className }: { className?: string }) {
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
}

function RotateIcon({ className }: { className?: string }) {
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
}

function UndoIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
			<path d="M3 3v5h5" />
		</svg>
	);
}

interface PageItem {
	id: string;
	pageNumber: number;
	deleted: boolean;
	rotation: 0 | 90 | 180 | 270;
}

export default function DeletePage() {
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pageItems, setPageItems] = useState<PageItem[]>([]);
	const [draggedId, setDraggedId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const processingRef = useRef(false);

	const { pages, loading: pagesLoading } = usePdfPages(file, 0.3);

	const handleFileSelected = useCallback((files: File[]) => {
		if (files.length > 0) {
			setFile(files[0]);
			setError(null);
			setPageItems([]);
		}
	}, []);

	// Initialize page items when pages load
	if (pages.length > 0 && pageItems.length === 0) {
		setPageItems(
			pages.map((p) => ({
				id: `page-${p.pageNumber}`,
				pageNumber: p.pageNumber,
				deleted: false,
				rotation: 0,
			})),
		);
	}

	const handleClear = useCallback(() => {
		setFile(null);
		setError(null);
		setPageItems([]);
	}, []);

	const toggleDelete = (id: string) => {
		setPageItems((prev) =>
			prev.map((p) => (p.id === id ? { ...p, deleted: !p.deleted } : p)),
		);
	};

	const rotatePage = (id: string) => {
		setPageItems((prev) =>
			prev.map((p) =>
				p.id === id
					? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 }
					: p,
			),
		);
	};

	// Drag handlers for reordering
	const handleDragStart = (e: React.DragEvent, id: string) => {
		const item = pageItems.find((p) => p.id === id);
		if (item?.deleted) return; // Don't drag deleted items
		setDraggedId(id);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent, id: string) => {
		e.preventDefault();
		const item = pageItems.find((p) => p.id === id);
		if (draggedId && draggedId !== id && !item?.deleted) {
			setDragOverId(id);
		}
	};

	const handleDragLeave = () => {
		setDragOverId(null);
	};

	const handleDrop = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		if (!draggedId || draggedId === targetId) {
			setDraggedId(null);
			setDragOverId(null);
			return;
		}

		const dragIndex = pageItems.findIndex((p) => p.id === draggedId);
		const dropIndex = pageItems.findIndex((p) => p.id === targetId);

		if (dragIndex === -1 || dropIndex === -1) return;

		const newItems = [...pageItems];
		const [removed] = newItems.splice(dragIndex, 1);
		newItems.splice(dropIndex, 0, removed);

		setPageItems(newItems);
		setDraggedId(null);
		setDragOverId(null);
	};

	const handleDragEnd = () => {
		setDraggedId(null);
		setDragOverId(null);
	};

	const handleDownload = async () => {
		if (!file || processingRef.current) return;

		const remainingItems = pageItems.filter((p) => !p.deleted);
		if (remainingItems.length === 0) {
			setError("Cannot delete all pages");
			return;
		}

		processingRef.current = true;
		setIsProcessing(true);
		setError(null);

		try {
			const pageSpecs = remainingItems.map((p) => ({
				pageNumber: p.pageNumber,
				rotation: p.rotation,
			}));
			const data = await extractPagesWithRotation(file, pageSpecs);

			const baseName = file.name.replace(/\.pdf$/i, "");
			downloadBlob(data, `${baseName}_edited.pdf`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to process PDF");
		} finally {
			setIsProcessing(false);
			processingRef.current = false;
		}
	};

	const deletedCount = pageItems.filter((p) => p.deleted).length;
	const remainingCount = pageItems.length - deletedCount;
	const rotatedCount = pageItems.filter(
		(p) => !p.deleted && p.rotation !== 0,
	).length;
	const hasChanges =
		deletedCount > 0 ||
		rotatedCount > 0 ||
		pageItems.some((p, i) => !p.deleted && p.pageNumber !== i + 1);

	const getPagePreview = (pageNumber: number) => {
		const page = pages.find((p) => p.pageNumber === pageNumber);
		return page?.dataUrl || "";
	};

	return (
		<div className="page-enter max-w-4xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<DeletePagesIcon className="w-7 h-7" />}
				iconClass="tool-delete"
				title="Delete Pages"
				description="Remove unwanted pages from your PDF"
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
									<p className="font-bold">Click to Delete</p>
									<p className="text-muted-foreground text-xs">
										Mark pages to remove
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground flex items-center justify-center shrink-0 text-xs font-bold">
									3
								</div>
								<div>
									<p className="font-bold">Download</p>
									<p className="text-muted-foreground text-xs">
										Get cleaned PDF
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
									{deletedCount > 0 && (
										<>
											<span className="text-muted-foreground">−</span>
											<span className="text-red-500 font-bold">
												{deletedCount} deleted
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
									<span className="font-bold">{remainingCount} remaining</span>
								</div>
								{hasChanges && (
									<button
										type="button"
										onClick={() =>
											setPageItems(
												pages.map((p) => ({
													id: `page-${p.pageNumber}`,
													pageNumber: p.pageNumber,
													deleted: false,
													rotation: 0,
												})),
											)
										}
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
											draggable={!item.deleted}
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
											{dragOverId === item.id && !item.deleted && (
												<div className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full" />
											)}

											<div
												role="button"
												tabIndex={0}
												onClick={() => toggleDelete(item.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														toggleDelete(item.id);
													}
												}}
												className={`relative border-2 overflow-hidden cursor-pointer transition-all ${
													item.deleted
														? "border-red-500/50 opacity-40"
														: "border-foreground/30 hover:border-foreground cursor-grab active:cursor-grabbing"
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
													/>
												</div>

												{/* Deleted overlay */}
												{item.deleted && (
													<div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
														<div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
															<XIcon className="w-8 h-8 text-white" />
														</div>
													</div>
												)}

												{/* Grip handle - only for non-deleted */}
												{!item.deleted && (
													<div className="absolute top-1 left-1 p-1 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity">
														<GripIcon className="w-3 h-3 text-white" />
													</div>
												)}

												{/* Rotate button - only for non-deleted */}
												{!item.deleted && (
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
												)}

												{/* Restore button - only for deleted */}
												{item.deleted && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															toggleDelete(item.id);
														}}
														className="absolute top-1 right-1 p-1.5 bg-white border-2 border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
														title="Restore page"
													>
														<UndoIcon className="w-3 h-3" />
													</button>
												)}

												{/* Bottom bar */}
												<div
													className={`absolute bottom-0 left-0 right-0 text-white text-xs py-1 px-2 flex items-center justify-between ${
														item.deleted ? "bg-red-500/70" : "bg-black/70"
													}`}
												>
													<span className="font-mono">
														{item.deleted
															? "×"
															: index +
																1 -
																pageItems
																	.slice(0, index)
																	.filter((p) => p.deleted).length}
													</span>
													<span className="text-white/60 text-[10px]">
														pg {item.pageNumber}
													</span>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>

							{error && <ErrorBox message={error} />}

							{/* Download button */}
							<button
								type="button"
								onClick={handleDownload}
								disabled={isProcessing || remainingCount === 0 || !hasChanges}
								className={`w-full ${deletedCount > 0 ? "btn-primary bg-red-600 hover:bg-red-700 border-red-600" : "btn-success"}`}
							>
								{isProcessing ? (
									<>
										<LoaderIcon className="w-5 h-5" />
										Processing...
									</>
								) : remainingCount === 0 ? (
									<>
										<XIcon className="w-5 h-5" />
										Cannot delete all pages
									</>
								) : (
									<>
										<DownloadIcon className="w-5 h-5" />
										Download PDF ({remainingCount} pages)
									</>
								)}
							</button>

							{!hasChanges && (
								<p className="text-center text-sm text-muted-foreground">
									Click on pages to mark them for deletion
								</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

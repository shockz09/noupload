"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
	GripIcon,
	LoaderIcon,
	NumbersIcon,
	OrganizeIcon,
	TrashIcon,
} from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	PageGridLoading,
	usePdfPages,
} from "@/components/pdf/pdf-page-preview";
import {
	ErrorBox,
	PdfPageHeader,
	ProgressBar,
	SuccessCard,
} from "@/components/pdf/shared";
import { addPageNumbers, downloadBlob, organizePDF } from "@/lib/pdf-utils";
import { getFileBaseName } from "@/lib/utils";

interface OrganizeResult {
	data: Uint8Array;
	filename: string;
}

interface PageItem {
	id: number; // Original page number (1-indexed)
	pageNumber: number;
	dataUrl: string;
}

export default function OrganizePage() {
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<OrganizeResult | null>(null);

	// Page order state - array of original page numbers in current order
	const [pageItems, setPageItems] = useState<PageItem[]>([]);
	const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

	// Drag state
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [settledIndex, setSettledIndex] = useState<number | null>(null);

	// Page numbering options
	const [addNumbers, setAddNumbers] = useState(false);
	const [numberPosition, setNumberPosition] = useState<"bottom-center" | "bottom-left" | "bottom-right" | "top-center">("bottom-center");
	const [numberFormat, setNumberFormat] = useState("{n}");

	const { pages, loading, progress } = usePdfPages(file, 0.5);

	// Initialize page items when pages load
	const prevPagesLength = useRef(0);
	if (pages.length > 0 && pages.length !== prevPagesLength.current) {
		prevPagesLength.current = pages.length;
		setPageItems(
			pages.map((p) => ({
				id: p.pageNumber,
				pageNumber: p.pageNumber,
				dataUrl: p.dataUrl,
			})),
		);
		setSelectedPages(new Set());
	}

	const handleFileSelected = useCallback((files: File[]) => {
		if (files.length > 0) {
			setFile(files[0]);
			setError(null);
			setResult(null);
			setPageItems([]);
			setSelectedPages(new Set());
			prevPagesLength.current = 0;
		}
	}, []);

	const handleClear = useCallback(() => {
		setFile(null);
		setError(null);
		setResult(null);
		setPageItems([]);
		setSelectedPages(new Set());
		prevPagesLength.current = 0;
	}, []);

	// Ref for stale closure prevention in drag handlers
	const draggedIndexRef = useRef<number | null>(null);

	// Drag and drop handlers
	const handleDragStart = useCallback((index: number) => {
		draggedIndexRef.current = index;
		setDraggedIndex(index);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (draggedIndexRef.current !== null && draggedIndexRef.current !== index) {
			setDragOverIndex(index);
		}
	}, []);

	const handleDragLeave = useCallback(() => {
		setDragOverIndex(null);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
		e.preventDefault();
		const currentDraggedIndex = draggedIndexRef.current;
		if (currentDraggedIndex === null || currentDraggedIndex === dropIndex) {
			draggedIndexRef.current = null;
			setDraggedIndex(null);
			setDragOverIndex(null);
			return;
		}

		setPageItems((prev) => {
			const newItems = [...prev];
			const [draggedItem] = newItems.splice(currentDraggedIndex, 1);
			newItems.splice(dropIndex, 0, draggedItem);
			return newItems;
		});

		draggedIndexRef.current = null;
		setDraggedIndex(null);
		setDragOverIndex(null);

		// Trigger settle animation
		setSettledIndex(dropIndex);
		setTimeout(() => setSettledIndex(null), 300);
	}, []);

	const handleDragEnd = useCallback(() => {
		draggedIndexRef.current = null;
		setDraggedIndex(null);
		setDragOverIndex(null);
	}, []);

	// Selection handlers
	const togglePageSelection = useCallback((id: number) => {
		setSelectedPages((prev) => {
			const newSelected = new Set(prev);
			if (newSelected.has(id)) {
				newSelected.delete(id);
			} else {
				newSelected.add(id);
			}
			return newSelected;
		});
	}, []);

	const handleDeleteSelected = useCallback(() => {
		if (selectedPages.size === 0) return;
		setPageItems((prev) => {
			if (selectedPages.size === prev.length) {
				setError("Cannot delete all pages");
				return prev;
			}
			return prev.filter((item) => !selectedPages.has(item.id));
		});
		setSelectedPages(new Set());
	}, [selectedPages]);

	const handleSelectAll = useCallback(() => {
		setSelectedPages((prev) => {
			// Check against current pageItems length
			return prev.size === pageItems.length
				? new Set<number>()
				: new Set(pageItems.map((p) => p.id));
		});
	}, [pageItems]);

	const handleOrganize = async () => {
		if (!file || pageItems.length === 0) return;

		setIsProcessing(true);
		setError(null);
		setResult(null);

		try {
			// Get the new page order (original page numbers)
			const pageOrder = pageItems.map((item) => item.id);
			let data = await organizePDF(file, pageOrder);

			// Add page numbers if enabled
			if (addNumbers) {
				const positionMap = {
					"bottom-center": { x: 50, y: 5 },
					"bottom-left": { x: 10, y: 5 },
					"bottom-right": { x: 90, y: 5 },
					"top-center": { x: 50, y: 95 },
				};
				const pos = positionMap[numberPosition];

				// Convert Uint8Array to File for addPageNumbers
				const tempFile = new File([new Uint8Array(data)], "temp.pdf", { type: "application/pdf" });
				data = await addPageNumbers(tempFile, {
					format: numberFormat,
					x: pos.x,
					y: pos.y,
				});
			}

			const baseName = getFileBaseName(file.name);
			setResult({
				data,
				filename: `${baseName}_organized.pdf`,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to organize PDF");
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
		setPageItems([]);
		setSelectedPages(new Set());
		prevPagesLength.current = 0;
	};

	// Memoize hasChanges calculation
	const hasChanges = useMemo(() => {
		if (pageItems.length !== pages.length) return true;
		return pageItems.some((item, index) => item.id !== index + 1);
	}, [pageItems, pages.length]);

	return (
		<div className="page-enter max-w-6xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<OrganizeIcon className="w-7 h-7" />}
				iconClass="tool-organize"
				title="Organize PDF"
				description="Drag to reorder, click to select, delete what you don't need"
			/>

			{result ? (
				<div className="max-w-2xl mx-auto">
					<SuccessCard
						stampText="Organized"
						title="PDF Organized!"
						downloadLabel="Download PDF"
						onDownload={handleDownload}
						onStartOver={handleStartOver}
						startOverLabel="Organize Another PDF"
					>
						<p className="text-muted-foreground">
							{pageItems.length} pages in your new order
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
					<div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border-2 border-foreground">
						<div className="flex items-center gap-4">
							<button
								type="button"
								onClick={handleClear}
								className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
							>
								Change file
							</button>
							<span className="text-muted-foreground">•</span>
							<span className="text-sm font-medium">
								{pageItems.length} pages
							</span>
						</div>

						<div className="flex items-center gap-3">
							{selectedPages.size > 0 && (
								<button
									type="button"
									onClick={handleDeleteSelected}
									className="flex items-center gap-2 px-4 py-2 bg-destructive text-white font-bold border-2 border-foreground hover:opacity-90 transition-opacity"
								>
									<TrashIcon className="w-4 h-4" />
									Delete {selectedPages.size} page
									{selectedPages.size > 1 ? "s" : ""}
								</button>
							)}
							<button
								type="button"
								onClick={handleSelectAll}
								className="px-4 py-2 text-sm font-bold bg-muted border-2 border-foreground hover:bg-accent transition-colors"
							>
								{selectedPages.size === pageItems.length
									? "Deselect All"
									: "Select All"}
							</button>
						</div>
					</div>

					{/* Page Grid */}
					{loading ? (
						<PageGridLoading progress={progress} />
					) : (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
							{pageItems.map((item, index) => (
								<div
									key={item.id}
									role="button"
									tabIndex={0}
									draggable
									onDragStart={() => handleDragStart(index)}
									onDragOver={(e) => handleDragOver(e, index)}
									onDragLeave={handleDragLeave}
									onDrop={(e) => handleDrop(e, index)}
									onDragEnd={handleDragEnd}
									onClick={() => togglePageSelection(item.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											togglePageSelection(item.id);
										}
									}}
									className={`
                    relative group cursor-grab active:cursor-grabbing
                    ${draggedIndex === index ? "drag-lifting" : ""}
                    ${dragOverIndex === index && draggedIndex !== index ? "drag-over-target" : ""}
                    ${settledIndex === index ? "drag-settled" : ""}
                    ${selectedPages.has(item.id) ? "ring-4 ring-destructive ring-offset-2" : ""}
                    ${draggedIndex !== null && draggedIndex !== index ? "drag-shifting" : ""}
                  `}
								>
									{/* Page container */}
									<div className="relative bg-white border-2 border-foreground overflow-hidden">
										{/* Drag handle */}
										<div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
											<div className="p-1 bg-white/90 border border-foreground/20">
												<GripIcon className="w-4 h-4 text-muted-foreground" />
											</div>
										</div>

										{/* Page number badge */}
										<div className="absolute top-2 right-2 z-10 file-number text-xs">
											{item.id}
										</div>

										{/* Selection checkbox */}
										<div
											className={`
                      absolute bottom-2 right-2 z-10 w-6 h-6 border-2 border-foreground
                      flex items-center justify-center transition-colors
                      ${selectedPages.has(item.id) ? "bg-destructive" : "bg-white/90"}
                    `}
										>
											{selectedPages.has(item.id) && (
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
											)}
										</div>

										{/* Image */}
										<img
											src={item.dataUrl}
											alt={`Page ${item.id}`}
											className="w-full h-auto block pointer-events-none"
											loading="lazy"
											decoding="async"
											draggable={false}
										/>

										{/* Position indicator */}
										<div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 bg-foreground text-white text-xs font-bold">
											{index + 1}
										</div>
									</div>
								</div>
							))}
						</div>
					)}

					{/* Page Numbers Option */}
					<div className="p-4 bg-card border-2 border-foreground space-y-4">
						<label className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={addNumbers}
								onChange={(e) => setAddNumbers(e.target.checked)}
								className="w-5 h-5 accent-primary"
							/>
							<div className="flex items-center gap-2">
								<NumbersIcon className="w-5 h-5" />
								<span className="font-bold">Add page numbers</span>
							</div>
						</label>

						{addNumbers && (
							<div className="pl-8 space-y-4">
								{/* Position */}
								<div className="space-y-2">
									<span className="text-sm font-medium text-muted-foreground">Position</span>
									<div className="flex flex-wrap gap-2">
										{[
											{ value: "bottom-center", label: "Bottom Center" },
											{ value: "bottom-left", label: "Bottom Left" },
											{ value: "bottom-right", label: "Bottom Right" },
											{ value: "top-center", label: "Top Center" },
										].map((pos) => (
											<button
												key={pos.value}
												type="button"
												onClick={() => setNumberPosition(pos.value as typeof numberPosition)}
												className={`px-3 py-1.5 text-xs font-bold border-2 border-foreground transition-colors ${
													numberPosition === pos.value
														? "bg-primary text-white"
														: "bg-muted hover:bg-accent"
												}`}
											>
												{pos.label}
											</button>
										))}
									</div>
								</div>

								{/* Format */}
								<div className="space-y-2">
									<span className="text-sm font-medium text-muted-foreground">Format</span>
									<div className="flex flex-wrap gap-2">
										{[
											{ value: "{n}", label: "1, 2, 3" },
											{ value: "Page {n}", label: "Page 1" },
											{ value: "{n} / {total}", label: "1 / 10" },
											{ value: "- {n} -", label: "- 1 -" },
										].map((fmt) => (
											<button
												key={fmt.value}
												type="button"
												onClick={() => setNumberFormat(fmt.value)}
												className={`px-3 py-1.5 text-xs font-bold border-2 border-foreground transition-colors ${
													numberFormat === fmt.value
														? "bg-primary text-white"
														: "bg-muted hover:bg-accent"
												}`}
											>
												{fmt.label}
											</button>
										))}
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Info */}
					<div className="info-box">
						<svg
							aria-hidden="true"
							className="w-5 h-5 mt-0.5"
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
							Drag pages to reorder. Click to select pages for deletion. The
							black number shows new position.
						</span>
					</div>

					{error && <ErrorBox message={error} />}
					{isProcessing && (
						<ProgressBar progress={50} label="Organizing PDF..." />
					)}

					{/* Action Button */}
					<button
						type="button"
						onClick={handleOrganize}
						disabled={isProcessing || pageItems.length === 0}
						className="btn-primary w-full"
					>
						{isProcessing ? (
							<>
								<LoaderIcon className="w-5 h-5" />
								Processing...
							</>
						) : (
							<>
								<OrganizeIcon className="w-5 h-5" />
								{hasChanges
									? `Save ${pageItems.length} Pages`
									: `Save PDF (${pageItems.length} pages)`}
							</>
						)}
					</button>
				</div>
			)}
		</div>
	);
}

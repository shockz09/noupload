"use client";

import { useCallback, useState } from "react";
import {
	BulkIcon,
	DownloadIcon,
	ImageIcon,
	LoaderIcon,
} from "@/components/icons";
import {
	ErrorBox,
	ImagePageHeader,
	ProgressBar,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { IMAGE_RESIZE_PRESETS } from "@/lib/constants";
import {
	downloadImage,
	formatFileSize,
	getOutputFilename,
	resizeImage,
} from "@/lib/image-utils";

interface FileItem {
	id: string;
	file: File;
}

interface ResizedItem {
	original: File;
	blob: Blob;
	filename: string;
}

export default function BulkResizePage() {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [width, setWidth] = useState(1920);
	const [height, setHeight] = useState(1080);
	const [maintainAspect, setMaintainAspect] = useState(true);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState({ current: 0, total: 0 });
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<ResizedItem[]>([]);

	const handleFilesSelected = useCallback((newFiles: File[]) => {
		const items = newFiles.map((file) => ({ id: crypto.randomUUID(), file }));
		setFiles((prev) => [...prev, ...items]);
		setError(null);
		setResults([]);
	}, []);

	const handleRemoveFile = (id: string) =>
		setFiles((prev) => prev.filter((f) => f.id !== id));
	const handleClearAll = () => {
		setFiles([]);
		setResults([]);
		setError(null);
	};
	const applyPreset = (preset: { width: number; height: number }) => {
		setWidth(preset.width);
		setHeight(preset.height);
	};

	const handleResize = async () => {
		if (files.length === 0) return;

		setIsProcessing(true);
		setError(null);
		setResults([]);
		setProgress({ current: 0, total: files.length });

		const resized: ResizedItem[] = [];
		const BATCH_SIZE = 5;

		try {
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				const batch = files.slice(i, i + BATCH_SIZE);
				const batchResults = await Promise.all(
					batch.map(async ({ file }) => {
						const blob = await resizeImage(file, width, height, maintainAspect);
						return {
							original: file,
							blob,
							filename: getOutputFilename(
								file.name,
								undefined,
								`_${width}x${height}`,
							),
						};
					}),
				);
				resized.push(...batchResults);
				setProgress({
					current: Math.min(i + BATCH_SIZE, files.length),
					total: files.length,
				});
			}
			setResults(resized);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to resize images");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownloadOne = (item: ResizedItem) =>
		downloadImage(item.blob, item.filename);
	const handleDownloadAll = async () => {
		for (const item of results) {
			downloadImage(item.blob, item.filename);
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	};
	const handleStartOver = () => {
		setFiles([]);
		setResults([]);
		setError(null);
		setProgress({ current: 0, total: 0 });
	};

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<BulkIcon className="w-7 h-7" />}
				iconClass="tool-bulk"
				title="Bulk Resize"
				description="Resize multiple images at once"
			/>

			{results.length > 0 ? (
				<div className="animate-fade-up space-y-6">
					<div className="success-card">
						<div className="success-stamp">
							<span className="success-stamp-text">Done</span>
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
						<div className="space-y-4 mb-6">
							<h2 className="text-3xl font-display">
								{results.length} Images Resized!
							</h2>
							<p className="text-muted-foreground">
								All resized to {width}×{height}
							</p>
						</div>
						<button
							type="button"
							onClick={handleDownloadAll}
							className="btn-success w-full mb-4"
						>
							<DownloadIcon className="w-5 h-5" />
							Download All ({results.length} files)
						</button>
					</div>

					<div className="space-y-2">
						{results.map((item, i) => (
							<div
								key={i}
								className="flex items-center justify-between p-3 border-2 border-foreground bg-background"
							>
								<div className="flex-1 min-w-0">
									<p className="font-bold text-sm truncate">{item.filename}</p>
									<p className="text-xs text-muted-foreground">
										{formatFileSize(item.blob.size)}
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleDownloadOne(item)}
									className="text-sm font-bold text-primary hover:underline ml-4"
								>
									Download
								</button>
							</div>
						))}
					</div>

					<button
						type="button"
						onClick={handleStartOver}
						className="btn-secondary w-full"
					>
						Resize More Images
					</button>
				</div>
			) : (
				<div className="space-y-6">
					<FileDropzone
						accept=".jpg,.jpeg,.png,.webp"
						multiple={true}
						maxFiles={50}
						onFilesSelected={handleFilesSelected}
						title="Drop your images here"
						subtitle="Select multiple files at once"
					/>

					{files.length > 0 && (
						<>
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="input-label">
										{files.length} files selected
									</span>
									<button
										type="button"
										onClick={handleClearAll}
										className="text-sm font-semibold text-muted-foreground hover:text-foreground"
									>
										Clear all
									</button>
								</div>
								<div className="max-h-40 overflow-y-auto space-y-1 border-2 border-foreground p-2">
									{files.map((item) => (
										<div
											key={item.id}
											className="flex items-center justify-between py-1 px-2 hover:bg-muted/50"
										>
											<div className="flex items-center gap-2 flex-1 min-w-0">
												<ImageIcon className="w-4 h-4 shrink-0" />
												<span className="text-sm truncate">
													{item.file.name}
												</span>
											</div>
											<button
												type="button"
												onClick={() => handleRemoveFile(item.id)}
												className="text-xs text-muted-foreground hover:text-foreground ml-2"
											>
												Remove
											</button>
										</div>
									))}
								</div>
							</div>

							<div className="space-y-3">
								<span className="input-label">Quick Presets</span>
								<div className="grid grid-cols-2 gap-2">
									{IMAGE_RESIZE_PRESETS.map((preset) => (
										<button
											type="button"
											key={preset.label}
											onClick={() => applyPreset(preset)}
											className="px-3 py-2 text-xs font-bold border-2 border-foreground hover:bg-foreground hover:text-background transition-colors text-left"
										>
											{preset.label}
										</button>
									))}
								</div>
							</div>

							<div className="space-y-3">
								<span className="input-label">Custom Size</span>
								<div className="flex items-center gap-3">
									<input
										type="number"
										value={width}
										onChange={(e) => setWidth(Number(e.target.value))}
										min={1}
										max={10000}
										className="input-field flex-1"
										placeholder="Width"
									/>
									<span className="font-bold">×</span>
									<input
										type="number"
										value={height}
										onChange={(e) => setHeight(Number(e.target.value))}
										min={1}
										max={10000}
										className="input-field flex-1"
										placeholder="Height"
									/>
								</div>
								<span className="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={maintainAspect}
										onChange={(e) => setMaintainAspect(e.target.checked)}
										className="w-5 h-5 border-2 border-foreground"
									/>
									<span className="text-sm font-medium">
										Maintain aspect ratio
									</span>
								</span>
							</div>

							{error && <ErrorBox message={error} />}
							{isProcessing && (
								<ProgressBar
									progress={(progress.current / progress.total) * 100}
									label={`Resizing ${progress.current} of ${progress.total}...`}
								/>
							)}

							<button
								type="button"
								onClick={handleResize}
								disabled={isProcessing || files.length === 0}
								className="btn-primary w-full"
							>
								{isProcessing ? (
									<>
										<LoaderIcon className="w-5 h-5" />
										Resizing...
									</>
								) : (
									<>
										<BulkIcon className="w-5 h-5" />
										Resize {files.length} Images to {width}×{height}
									</>
								)}
							</button>
						</>
					)}
				</div>
			)}
		</div>
	);
}

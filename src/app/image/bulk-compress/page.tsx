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
	SavingsBadge,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	compressImage,
	downloadImage,
	formatFileSize,
	getOutputFilename,
} from "@/lib/image-utils";

interface FileItem {
	id: string;
	file: File;
}

interface CompressedItem {
	original: File;
	blob: Blob;
	filename: string;
}

export default function BulkCompressPage() {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [quality, setQuality] = useState(80);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState({ current: 0, total: 0 });
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<CompressedItem[]>([]);

	const handleFilesSelected = useCallback((newFiles: File[]) => {
		const items = newFiles.map((file) => ({
			id: crypto.randomUUID(),
			file,
		}));
		setFiles((prev) => [...prev, ...items]);
		setError(null);
		setResults([]);
	}, []);

	const handleRemoveFile = (id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	};

	const handleClearAll = () => {
		setFiles([]);
		setResults([]);
		setError(null);
	};

	const handleCompress = async () => {
		if (files.length === 0) return;

		setIsProcessing(true);
		setError(null);
		setResults([]);
		setProgress({ current: 0, total: files.length });

		const compressed: CompressedItem[] = [];
		const BATCH_SIZE = 5;

		try {
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				const batch = files.slice(i, i + BATCH_SIZE);

				const batchResults = await Promise.all(
					batch.map(async ({ file }) => {
						const blob = await compressImage(file, quality / 100);
						return {
							original: file,
							blob,
							filename: getOutputFilename(file.name, "jpeg", "_compressed"),
						};
					}),
				);

				compressed.push(...batchResults);
				setProgress({
					current: Math.min(i + BATCH_SIZE, files.length),
					total: files.length,
				});
			}

			setResults(compressed);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to compress images",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownloadOne = (item: CompressedItem) => {
		downloadImage(item.blob, item.filename);
	};

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

	const totalOriginalSize = files.reduce((sum, f) => sum + f.file.size, 0);
	const totalCompressedSize = results.reduce((sum, r) => sum + r.blob.size, 0);
	const totalSavings =
		results.length > 0
			? Math.round((1 - totalCompressedSize / totalOriginalSize) * 100)
			: 0;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<BulkIcon className="w-7 h-7" />}
				iconClass="tool-bulk"
				title="Bulk Compress"
				description="Compress multiple images at once"
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
								{results.length} Images Compressed!
							</h2>
							<SavingsBadge savings={totalSavings} />
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
						{results.map((item, i) => {
							const savings = Math.round(
								(1 - item.blob.size / item.original.size) * 100,
							);
							return (
								<div
									key={i}
									className="flex items-center justify-between p-3 border-2 border-foreground bg-background"
								>
									<div className="flex-1 min-w-0">
										<p className="font-bold text-sm truncate">
											{item.filename}
										</p>
										<p className="text-xs text-muted-foreground">
											{formatFileSize(item.original.size)} →{" "}
											{formatFileSize(item.blob.size)} ({savings}% saved)
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
							);
						})}
					</div>

					<button
						type="button"
						onClick={handleStartOver}
						className="btn-secondary w-full"
					>
						Compress More Images
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
								<div className="max-h-48 overflow-y-auto space-y-1 border-2 border-foreground p-2">
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
												<span className="text-xs text-muted-foreground shrink-0">
													{formatFileSize(item.file.size)}
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
								<p className="text-xs text-muted-foreground">
									Total: {formatFileSize(totalOriginalSize)}
								</p>
							</div>

							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="input-label">Quality</span>
									<span className="text-sm font-bold">{quality}%</span>
								</div>
								<input
									type="range"
									min="10"
									max="100"
									value={quality}
									onChange={(e) => setQuality(Number(e.target.value))}
									className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:cursor-pointer"
								/>
							</div>

							{error && <ErrorBox message={error} />}

							{isProcessing && (
								<ProgressBar
									progress={(progress.current / progress.total) * 100}
									label={`Compressing ${progress.current} of ${progress.total}...`}
								/>
							)}

							<button
								type="button"
								onClick={handleCompress}
								disabled={isProcessing || files.length === 0}
								className="btn-primary w-full"
							>
								{isProcessing ? (
									<>
										<LoaderIcon className="w-5 h-5" />
										Compressing...
									</>
								) : (
									<>
										<BulkIcon className="w-5 h-5" />
										Compress {files.length} Images
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

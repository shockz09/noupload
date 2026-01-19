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
import { IMAGE_FORMATS_BULK } from "@/lib/constants";
import {
	convertFormat,
	downloadImage,
	formatFileSize,
	type ImageFormat,
} from "@/lib/image-utils";
import { getFileBaseName } from "@/lib/utils";

interface FileItem {
	id: string;
	file: File;
}

interface ConvertedItem {
	original: File;
	blob: Blob;
	filename: string;
}

export default function BulkConvertPage() {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [targetFormat, setTargetFormat] = useState<ImageFormat>("jpeg");
	const [quality, setQuality] = useState(90);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState({ current: 0, total: 0 });
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<ConvertedItem[]>([]);

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

	const handleConvert = async () => {
		if (files.length === 0) return;

		setIsProcessing(true);
		setError(null);
		setResults([]);
		setProgress({ current: 0, total: files.length });

		const converted: ConvertedItem[] = [];
		const ext =
			IMAGE_FORMATS_BULK.find((f) => f.value === targetFormat)?.ext ||
			targetFormat;
		const BATCH_SIZE = 5;

		try {
			for (let i = 0; i < files.length; i += BATCH_SIZE) {
				const batch = files.slice(i, i + BATCH_SIZE);
				const batchResults = await Promise.all(
					batch.map(async ({ file }) => {
						const blob = await convertFormat(file, targetFormat, quality / 100);
						const baseName = getFileBaseName(file.name);
						return { original: file, blob, filename: `${baseName}.${ext}` };
					}),
				);
				converted.push(...batchResults);
				setProgress({
					current: Math.min(i + BATCH_SIZE, files.length),
					total: files.length,
				});
			}
			setResults(converted);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to convert images");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownloadOne = (item: ConvertedItem) =>
		downloadImage(item.blob, item.filename);
	const handleDownloadAll = () => {
		for (const item of results) {
			downloadImage(item.blob, item.filename);
		}
	};
	const handleStartOver = () => {
		setFiles([]);
		setResults([]);
		setError(null);
		setProgress({ current: 0, total: 0 });
	};

	const showQuality = targetFormat === "jpeg" || targetFormat === "webp";

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<BulkIcon className="w-7 h-7" />}
				iconClass="tool-bulk-convert"
				title="Bulk Convert"
				description="Convert multiple images to a new format"
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
								{results.length} Images Converted!
							</h2>
							<p className="text-muted-foreground">
								All converted to {targetFormat.toUpperCase()}
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
						{results.map((item) => (
							<div
								key={item.filename}
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
						Convert More Images
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
								<span className="input-label">Convert to</span>
								<div className="grid grid-cols-3 gap-2">
									{IMAGE_FORMATS_BULK.map((format) => (
										<button
											type="button"
											key={format.value}
											onClick={() => setTargetFormat(format.value)}
											className={`px-4 py-3 text-sm font-bold border-2 border-foreground transition-colors ${targetFormat === format.value ? "bg-foreground text-background" : "hover:bg-muted"}`}
										>
											{format.label}
										</button>
									))}
								</div>
							</div>

							{showQuality && (
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
							)}

							{error && <ErrorBox message={error} />}
							{isProcessing && (
								<ProgressBar
									progress={(progress.current / progress.total) * 100}
									label={`Converting ${progress.current} of ${progress.total}...`}
								/>
							)}

							<button
								type="button"
								onClick={handleConvert}
								disabled={isProcessing || files.length === 0}
								className="btn-primary w-full"
							>
								{isProcessing ? (
									<>
										<LoaderIcon className="w-5 h-5" />
										Converting...
									</>
								) : (
									<>
										<BulkIcon className="w-5 h-5" />
										Convert {files.length} Images to{" "}
										{targetFormat.toUpperCase()}
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

"use client";

import { useCallback, useRef, useState } from "react";
import { CompressIcon, PdfIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	ComparisonDisplay,
	ErrorBox,
	PdfFileInfo,
	PdfPageHeader,
	ProgressBar,
	SavingsBadge,
	SuccessCard,
} from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import {
	COMPRESSION_DESCRIPTIONS,
	useGhostscript,
	type CompressionLevel,
} from "@/lib/ghostscript/useGhostscript";
import { downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";

interface CompressResult {
	data: Uint8Array;
	filename: string;
	originalSize: number;
	compressedSize: number;
}

export default function CompressPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const { compress: gsCompress, progress: gsProgress } = useGhostscript();
	const [file, setFile] = useState<File | null>(null);
	const [compressionLevel, setCompressionLevel] =
		useState<CompressionLevel>("balanced");
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<CompressResult | null>(null);
	const processingRef = useRef(false);

	const processFile = useCallback(
		async (fileToProcess: File, level: CompressionLevel = "balanced") => {
			if (processingRef.current) return;
			processingRef.current = true;
			setIsProcessing(true);
			setError(null);
			setResult(null);

			try {
				const compressed = await gsCompress(fileToProcess, level);

				const baseName = fileToProcess.name.replace(".pdf", "");
				setResult({
					data: compressed,
					filename: `${baseName}_compressed.pdf`,
					originalSize: fileToProcess.size,
					compressedSize: compressed.length,
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to compress PDF");
			} finally {
				setIsProcessing(false);
				processingRef.current = false;
			}
		},
		[gsCompress],
	);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				setFile(files[0]);
				setError(null);
				setResult(null);

				if (isInstant) {
					processFile(files[0], compressionLevel);
				}
			}
		},
		[isInstant, processFile, compressionLevel],
	);

	const handleClear = useCallback(() => {
		setFile(null);
		setError(null);
		setResult(null);
	}, []);

	const handleCompress = async () => {
		if (!file) return;
		processFile(file, compressionLevel);
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
	};

	const savings = result
		? Math.round((1 - result.compressedSize / result.originalSize) * 100)
		: 0;

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<CompressIcon className="w-7 h-7" />}
				iconClass="tool-compress"
				title="Compress PDF"
				description="Reduce file size with Ghostscript-powered compression"
			/>

			{result ? (
				<SuccessCard
					stampText="Optimized"
					title="PDF Compressed!"
					downloadLabel="Download PDF"
					onDownload={handleDownload}
					onStartOver={handleStartOver}
					startOverLabel="Compress Another"
				>
					<ComparisonDisplay
						originalLabel="Original"
						originalValue={formatFileSize(result.originalSize)}
						newLabel="Compressed"
						newValue={formatFileSize(result.compressedSize)}
					/>
					<SavingsBadge savings={savings} />
				</SuccessCard>
			) : !file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".pdf"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your PDF file here"
					/>

					{/* Compression Level Selector */}
					<div className="space-y-3">
						<label className="text-sm font-medium text-foreground">
							Compression Level
						</label>
						<div className="grid grid-cols-3 gap-3">
							{(["light", "balanced", "maximum"] as CompressionLevel[]).map(
								(level) => (
									<button
										key={level}
										type="button"
										onClick={() => setCompressionLevel(level)}
										className={`p-3 rounded-lg border-2 transition-all text-left ${
											compressionLevel === level
												? "border-primary bg-primary/5"
												: "border-border hover:border-muted-foreground/50"
										}`}
									>
										<div className="font-medium capitalize text-sm">
											{level}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											{level === "light" && "Best quality"}
											{level === "balanced" && "Recommended"}
											{level === "maximum" && "Smallest size"}
										</div>
									</button>
								),
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							{COMPRESSION_DESCRIPTIONS[compressionLevel]}
						</p>
					</div>

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
						<div className="text-sm">
							<p className="font-bold text-foreground mb-1">
								{isInstant ? "Instant compression" : "Powered by Ghostscript"}
							</p>
							<p className="text-muted-foreground">
								{isInstant
									? "Drop a PDF and it will be compressed automatically."
									: "Real image recompression for major file size reduction. First use downloads ~16MB engine (cached)."}
							</p>
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

					{/* Compression Level Selector (when file selected) */}
					{!isProcessing && (
						<div className="space-y-3">
							<label className="text-sm font-medium text-foreground">
								Compression Level
							</label>
							<div className="grid grid-cols-3 gap-3">
								{(["light", "balanced", "maximum"] as CompressionLevel[]).map(
									(level) => (
										<button
											key={level}
											type="button"
											onClick={() => setCompressionLevel(level)}
											className={`p-3 rounded-lg border-2 transition-all text-left ${
												compressionLevel === level
													? "border-primary bg-primary/5"
													: "border-border hover:border-muted-foreground/50"
											}`}
										>
											<div className="font-medium capitalize text-sm">
												{level}
											</div>
											<div className="text-xs text-muted-foreground mt-1">
												{level === "light" && "Best quality"}
												{level === "balanced" && "Recommended"}
												{level === "maximum" && "Smallest size"}
											</div>
										</button>
									),
								)}
							</div>
						</div>
					)}

					{error && <ErrorBox message={error} />}
					{isProcessing && (
						<ProgressBar progress={-1} label={gsProgress || "Processing..."} />
					)}

					<button
						type="button"
						onClick={handleCompress}
						disabled={isProcessing}
						className="btn-primary w-full"
					>
						{isProcessing ? (
							<>
								<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								{gsProgress || "Compressing..."}
							</>
						) : (
							<>
								<CompressIcon className="w-5 h-5" />
								Compress PDF
							</>
						)}
					</button>
				</div>
			)}
		</div>
	);
}

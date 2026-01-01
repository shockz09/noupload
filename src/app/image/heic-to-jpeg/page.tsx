"use client";

import { useCallback, useRef, useState } from "react";
import { HeicIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import {
	ComparisonDisplay,
	ErrorBox,
	ImageFileInfo,
	ImagePageHeader,
	SuccessCard,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import {
	convertHeicToJpeg,
	copyImageToClipboard,
	downloadImage,
	formatFileSize,
} from "@/lib/image-utils";

interface ConvertResult {
	blob: Blob;
	filename: string;
	originalSize: number;
}

export default function HeicToJpegPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ConvertResult | null>(null);
	const processingRef = useRef(false);

	const processFile = useCallback(async (fileToProcess: File) => {
		if (processingRef.current) return;
		processingRef.current = true;
		setIsProcessing(true);
		setProgress(0);
		setError(null);
		setResult(null);

		try {
			setProgress(20);
			const converted = await convertHeicToJpeg(fileToProcess);
			setProgress(90);

			const baseName = fileToProcess.name
				.replace(/\.heic$/i, "")
				.replace(/\.heif$/i, "");
			setResult({
				blob: converted,
				filename: `${baseName}.jpg`,
				originalSize: fileToProcess.size,
			});
			setProgress(100);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to convert HEIC.");
		} finally {
			setIsProcessing(false);
			processingRef.current = false;
		}
	}, []);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				const selectedFile = files[0];
				setFile(selectedFile);
				setError(null);
				setResult(null);
				if (isInstant) {
					processFile(selectedFile);
				}
			}
		},
		[isInstant, processFile],
	);

	const handleDownload = (e: React.MouseEvent) => {
		e.preventDefault();
		if (result) downloadImage(result.blob, result.filename);
	};

	const handleClear = () => {
		setFile(null);
		setError(null);
		setResult(null);
		setProgress(0);
	};

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<HeicIcon className="w-7 h-7" />}
				iconClass="tool-heic"
				title="HEIC → JPEG"
				description="Convert iPhone photos to standard JPEG format"
			/>

			{result ? (
				<SuccessCard
					stampText="Converted"
					title="HEIC Converted!"
					downloadLabel="Download JPEG"
					onDownload={handleDownload}
					onCopy={() => copyImageToClipboard(result.blob)}
					onStartOver={handleClear}
					startOverLabel="Convert Another"
				>
					<ComparisonDisplay
						originalLabel="Original"
						originalValue="HEIC"
						newLabel="Converted"
						newValue="JPEG"
					/>
					<p className="text-sm text-muted-foreground">
						{formatFileSize(result.originalSize)} →{" "}
						{formatFileSize(result.blob.size)}
					</p>
				</SuccessCard>
			) : isProcessing ? (
				<div className="border-2 border-foreground p-12 bg-card">
					<div className="flex flex-col items-center justify-center gap-4">
						<LoaderIcon className="w-8 h-8 animate-spin" />
						<div className="text-center">
							<p className="font-bold">Converting to JPEG...</p>
							<p className="text-sm text-muted-foreground">{file?.name}</p>
						</div>
						<div className="w-full max-w-xs h-2 bg-muted border-2 border-foreground">
							<div
								className="h-full bg-foreground transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				</div>
			) : error ? (
				<div className="space-y-4">
					<ErrorBox message={error} />
					<button
						type="button"
						onClick={handleClear}
						className="btn-secondary w-full"
					>
						Try Again
					</button>
				</div>
			) : !file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".heic,.heif"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your HEIC file here"
						subtitle="or click to browse from your device"
					/>
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
								{isInstant ? "Instant conversion" : "Manual mode"}
							</p>
							<p className="text-muted-foreground">
								{isInstant
									? "Drop a HEIC file and it will be converted automatically."
									: "Drop a HEIC file, then click to convert."}
							</p>
						</div>
					</div>
				</div>
			) : (
				<div className="space-y-6">
					<ImageFileInfo
						file={file}
						fileSize={formatFileSize(file.size)}
						onClear={handleClear}
						icon={<ImageIcon className="w-5 h-5" />}
					/>
					<button
						type="button"
						onClick={() => processFile(file)}
						disabled={isProcessing}
						className="btn-primary w-full"
					>
						<HeicIcon className="w-5 h-5" />
						Convert to JPEG
					</button>
				</div>
			)}
		</div>
	);
}

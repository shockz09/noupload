"use client";

import { useCallback, useMemo, useState } from "react";
import { ImageCompressIcon, ImageIcon } from "@/components/icons";
import {
	ComparisonDisplay,
	ErrorBox,
	ImageFileInfo,
	ImagePageHeader,
	ProcessButton,
	ProgressBar,
	SavingsBadge,
	SuccessCard,
} from "@/components/image/shared";
import { InfoBox, QualitySlider } from "@/components/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import {
	useFileProcessing,
	useImagePaste,
	useObjectURL,
	useProcessingResult,
} from "@/hooks";
import {
	compressImage,
	copyImageToClipboard,
	formatFileSize,
	getOutputFilename,
} from "@/lib/image-utils";

interface CompressMetadata {
	originalSize: number;
	compressedSize: number;
}

export default function ImageCompressPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const [file, setFile] = useState<File | null>(null);
	const [quality, setQuality] = useState(80);

	// Use custom hooks for common patterns
	const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
	const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError } = useFileProcessing();
	const { result, setResult, clearResult, download } = useProcessingResult<CompressMetadata>();

	const processFile = useCallback(async (fileToProcess: File, q: number) => {
		if (!startProcessing()) return;

		try {
			setProgress(30);
			const compressed = await compressImage(fileToProcess, q / 100);
			setProgress(90);
			setResult(
				compressed,
				getOutputFilename(fileToProcess.name, "jpeg", "_compressed"),
				{ originalSize: fileToProcess.size, compressedSize: compressed.size }
			);
			setProgress(100);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to compress image");
		} finally {
			stopProcessing();
		}
	}, [startProcessing, setProgress, setResult, setError, stopProcessing]);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				const selectedFile = files[0];
				setFile(selectedFile);
				clearResult();
				setPreview(selectedFile);

				if (isInstant) {
					processFile(selectedFile, 80);
				}
			}
		},
		[isInstant, processFile, clearResult, setPreview],
	);

	// Use clipboard paste hook
	useImagePaste(handleFileSelected, !result);

	const handleClear = useCallback(() => {
		revokePreview();
		setFile(null);
		clearResult();
	}, [revokePreview, clearResult]);

	const handleCompress = useCallback(async () => {
		if (!file) return;
		processFile(file, quality);
	}, [file, quality, processFile]);

	const handleDownload = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		download();
	}, [download]);

	const handleStartOver = useCallback(() => {
		revokePreview();
		setFile(null);
		clearResult();
	}, [revokePreview, clearResult]);

	const savings = useMemo(() => result?.metadata
		? Math.round((1 - result.metadata.compressedSize / result.metadata.originalSize) * 100)
		: 0, [result]);

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<ImageCompressIcon className="w-7 h-7" />}
				iconClass="tool-image-compress"
				title="Compress Image"
				description="Reduce file size while keeping quality"
			/>

			{result ? (
				<SuccessCard
					stampText="Optimized"
					title="Image Compressed!"
					downloadLabel="Download Image"
					onDownload={handleDownload}
					onCopy={() => copyImageToClipboard(result.blob)}
					onStartOver={handleStartOver}
					startOverLabel="Compress Another"
				>
					<ComparisonDisplay
						originalLabel="Original"
						originalValue={formatFileSize(result.metadata?.originalSize ?? 0)}
						newLabel="Compressed"
						newValue={formatFileSize(result.metadata?.compressedSize ?? 0)}
					/>
					<SavingsBadge savings={savings} />
				</SuccessCard>
			) : !file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".jpg,.jpeg,.png,.webp"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your image here"
						subtitle="or click to browse · Ctrl+V to paste"
					/>
					<InfoBox title={isInstant ? "Instant compression" : "About compression"}>
						{isInstant
							? "Drop an image and it will be compressed at 80% quality automatically."
							: "Compresses images using JPEG encoding. Adjust the quality slider to balance file size and visual quality."}
					</InfoBox>
				</div>
			) : (
				<div className="space-y-6">
					{preview && (
						<div className="border-2 border-foreground p-4 bg-muted/30">
							<img
								src={preview}
								alt="Preview"
								className="max-h-64 mx-auto object-contain"
								loading="lazy"
								decoding="async"
							/>
						</div>
					)}

					<ImageFileInfo
						file={file}
						fileSize={formatFileSize(file.size)}
						onClear={handleClear}
						icon={<ImageIcon className="w-5 h-5" />}
					/>

					<QualitySlider
						label="Quality"
						value={quality}
						onChange={setQuality}
					/>

					{error && <ErrorBox message={error} />}
					{isProcessing && (
						<ProgressBar progress={progress} label="Compressing..." />
					)}

					<ProcessButton
						onClick={handleCompress}
						isProcessing={isProcessing}
						processingLabel="Compressing..."
						icon={<ImageCompressIcon className="w-5 h-5" />}
						label="Compress Image"
					/>
				</div>
			)}
		</div>
	);
}

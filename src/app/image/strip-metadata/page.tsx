"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	ImageIcon,
	LoaderIcon,
	MetadataIcon,
	ShieldIcon,
} from "@/components/icons";
import {
	ErrorBox,
	ImageFileInfo,
	ImagePageHeader,
	SuccessCard,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import {
	copyImageToClipboard,
	downloadImage,
	formatFileSize,
	getOutputFilename,
	stripMetadata,
} from "@/lib/image-utils";

interface StripResult {
	blob: Blob;
	filename: string;
	originalSize: number;
}

export default function StripMetadataPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<StripResult | null>(null);
	const processingRef = useRef(false);

	const processFile = useCallback(async (fileToProcess: File) => {
		if (processingRef.current) return;
		processingRef.current = true;
		setIsProcessing(true);
		setError(null);
		setResult(null);

		try {
			const stripped = await stripMetadata(fileToProcess);
			setResult({
				blob: stripped,
				filename: getOutputFilename(fileToProcess.name, undefined, "_clean"),
				originalSize: fileToProcess.size,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to strip metadata");
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
				const url = URL.createObjectURL(selectedFile);
				if (preview) URL.revokeObjectURL(preview);
				setPreview(url);

				// Auto-process if instant mode is on
				if (isInstant) {
					processFile(selectedFile);
				}
			}
		},
		[isInstant, processFile, preview],
	);

	useEffect(() => {
		return () => {
			if (preview) URL.revokeObjectURL(preview);
		};
	}, [preview]);

	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			for (const item of items) {
				if (item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) handleFileSelected([file]);
					break;
				}
			}
		};
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [handleFileSelected]);

	const handleDownload = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (result) downloadImage(result.blob, result.filename);
	};

	const handleClear = () => {
		if (preview) URL.revokeObjectURL(preview);
		setFile(null);
		setPreview(null);
		setError(null);
		setResult(null);
	};

	const handleStartOver = () => {
		handleClear();
	};

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<MetadataIcon className="w-7 h-7" />}
				iconClass="tool-strip-metadata"
				title="Strip Metadata"
				description="Remove EXIF data and GPS location from photos"
			/>

			{result ? (
				<SuccessCard
					stampText="Clean"
					title="Metadata Removed!"
					downloadLabel="Download Clean Image"
					onDownload={handleDownload}
					onCopy={() => copyImageToClipboard(result.blob)}
					onStartOver={handleStartOver}
					startOverLabel="Clean Another"
				>
					<div className="bg-muted/50 border-2 border-foreground p-4 text-left">
						<p className="font-bold text-sm mb-2">Removed data includes:</p>
						<ul className="text-sm text-muted-foreground space-y-1">
							<li>• Camera make and model</li>
							<li>• GPS coordinates and location</li>
							<li>• Date and time taken</li>
							<li>• Software used</li>
						</ul>
					</div>
					<p className="text-sm text-muted-foreground">
						New file size: {formatFileSize(result.blob.size)}
					</p>
				</SuccessCard>
			) : isProcessing ? (
				<div className="border-2 border-foreground p-12 bg-card">
					<div className="flex flex-col items-center justify-center gap-4">
						<LoaderIcon className="w-8 h-8 animate-spin" />
						<div className="text-center">
							<p className="font-bold">Removing metadata...</p>
							<p className="text-sm text-muted-foreground">{file?.name}</p>
						</div>
					</div>
				</div>
			) : error ? (
				<div className="space-y-4">
					<ErrorBox message={error} />
					<button
						type="button"
						onClick={handleStartOver}
						className="btn-secondary w-full"
					>
						Try Again
					</button>
				</div>
			) : !file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".jpg,.jpeg,.png,.webp"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your image here"
						subtitle="or click to browse · Ctrl+V to paste"
					/>

					<div className="info-box">
						<ShieldIcon className="w-5 h-5 mt-0.5" />
						<div className="text-sm">
							<p className="font-bold text-foreground mb-1">
								{isInstant ? "Instant processing" : "Manual mode"}
							</p>
							<p className="text-muted-foreground">
								{isInstant
									? "Drop or paste an image and it will be cleaned automatically."
									: "Drop an image, review it, then click to process."}
							</p>
						</div>
					</div>
				</div>
			) : (
				/* Manual mode - show file info and process button */
				<div className="space-y-6">
					{preview && (
						<div className="border-2 border-foreground p-4 bg-muted/30">
							<img
								src={preview}
								alt="Preview"
								className="max-h-48 mx-auto object-contain"
							/>
						</div>
					)}

					<ImageFileInfo
						file={file}
						fileSize={formatFileSize(file.size)}
						onClear={handleClear}
						icon={<ImageIcon className="w-5 h-5" />}
					/>

					<div className="bg-[#FEF3C7] border-2 border-foreground p-4">
						<div className="flex gap-3">
							<svg
								aria-hidden="true"
								className="w-5 h-5 text-[#92400E] shrink-0 mt-0.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
								<line x1="12" y1="9" x2="12" y2="13" />
								<line x1="12" y1="17" x2="12.01" y2="17" />
							</svg>
							<div className="text-sm">
								<p className="font-bold text-[#92400E] mb-1">
									What will be removed
								</p>
								<p className="text-[#92400E]/80">
									All EXIF metadata including camera info, GPS location, date
									taken, and any other embedded data.
								</p>
							</div>
						</div>
					</div>

					<button
						type="button"
						onClick={() => processFile(file)}
						disabled={isProcessing}
						className="btn-primary w-full"
					>
						<ShieldIcon className="w-5 h-5" />
						Remove All Metadata
					</button>
				</div>
			)}
		</div>
	);
}

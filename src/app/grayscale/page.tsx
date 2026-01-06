"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PdfIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	ErrorBox,
	PdfFileInfo,
	PdfPageHeader,
	ProgressBar,
	SuccessCard,
} from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useGhostscript } from "@/lib/ghostscript/useGhostscript";
import { downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";

// Grayscale icon
function GrayscaleIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" />
		</svg>
	);
}

interface ConvertResult {
	data: Uint8Array;
	filename: string;
	originalSize: number;
	newSize: number;
}

export default function GrayscalePage() {
	const { isInstant, isLoaded } = useInstantMode();
	const { toGrayscale, progress: gsProgress } = useGhostscript();
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ConvertResult | null>(null);
	const processingRef = useRef(false);
	const instantTriggeredRef = useRef(false);

	const processFile = useCallback(
		async (fileToProcess: File) => {
			if (processingRef.current) return;
			processingRef.current = true;
			setIsProcessing(true);
			setError(null);
			setResult(null);

			try {
				const converted = await toGrayscale(fileToProcess);

				const baseName = fileToProcess.name.replace(".pdf", "");
				setResult({
					data: converted,
					filename: `${baseName}_grayscale.pdf`,
					originalSize: fileToProcess.size,
					newSize: converted.length,
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to convert PDF");
			} finally {
				setIsProcessing(false);
				processingRef.current = false;
			}
		},
		[toGrayscale],
	);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				setFile(files[0]);
				setError(null);
				setResult(null);
				instantTriggeredRef.current = false;
			}
		},
		[],
	);

	// Instant mode auto-process
	useEffect(() => {
		if (isInstant && file && !instantTriggeredRef.current && !isProcessing && !result) {
			instantTriggeredRef.current = true;
			processFile(file);
		}
	}, [isInstant, file, isProcessing, result, processFile]);

	const handleClear = useCallback(() => {
		setFile(null);
		setError(null);
		setResult(null);
	}, []);

	const handleConvert = async () => {
		if (!file) return;
		processFile(file);
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
		instantTriggeredRef.current = false;
	};

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<GrayscaleIcon className="w-7 h-7" />}
				iconClass="tool-grayscale"
				title="Grayscale PDF"
				description="Convert color PDFs to black and white"
			/>

			{result ? (
				<SuccessCard
					stampText="Converted"
					title="PDF Converted to Grayscale!"
					downloadLabel="Download PDF"
					onDownload={handleDownload}
					onStartOver={handleStartOver}
					startOverLabel="Convert Another"
				>
					<div className="text-center text-sm text-muted-foreground">
						<p>{formatFileSize(result.originalSize)} → {formatFileSize(result.newSize)}</p>
					</div>
				</SuccessCard>
			) : !file ? (
				<div className="space-y-6">
					<FileDropzone
						accept=".pdf"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your PDF file here"
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
								{isInstant ? "Instant conversion" : "About grayscale"}
							</p>
							<p className="text-muted-foreground">
								{isInstant
									? "Drop a PDF and it will be converted automatically."
									: "Converts all colors to shades of gray. Great for printing or reducing file size."}
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

					{error && <ErrorBox message={error} />}
					{isProcessing && (
						<ProgressBar progress={-1} label={gsProgress || "Processing..."} />
					)}

					<button
						type="button"
						onClick={handleConvert}
						disabled={isProcessing}
						className="btn-primary w-full"
					>
						{isProcessing ? (
							<>
								<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								{gsProgress || "Converting..."}
							</>
						) : (
							<>
								<GrayscaleIcon className="w-5 h-5" />
								Convert to Grayscale
							</>
						)}
					</button>
				</div>
			)}
		</div>
	);
}

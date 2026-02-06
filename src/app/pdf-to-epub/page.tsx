"use client";

import { useCallback, useState } from "react";
import { BookIcon, PdfIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	ErrorBox,
	PdfFileInfo,
	PdfPageHeader,
	ProcessButton,
	ProgressBar,
	SuccessCard,
} from "@/components/pdf/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing } from "@/hooks";
import { formatFileSize } from "@/lib/utils";
import { convertPdfToEpub } from "@/lib/pdf-to-epub";

interface ConvertResult {
	blob: Blob;
	filename: string;
	chapterCount: number;
	pageCount: number;
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export default function PdfToEpubPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const [file, setFile] = useState<File | null>(null);
	const [result, setResult] = useState<ConvertResult | null>(null);

	const {
		isProcessing,
		progress,
		error,
		startProcessing,
		stopProcessing,
		setProgress,
		setError,
		clearError,
	} = useFileProcessing();

	const processFile = useCallback(
		async (fileToProcess: File) => {
			if (!startProcessing()) return;
			setResult(null);

			try {
				const conversionResult = await convertPdfToEpub(
					fileToProcess,
					(p) => setProgress(p),
				);

				setResult({
					blob: conversionResult.blob,
					filename: conversionResult.filename,
					chapterCount: conversionResult.chapterCount,
					pageCount: conversionResult.pageCount,
				});
				setProgress(100);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to convert PDF to EPUB",
				);
			} finally {
				stopProcessing();
			}
		},
		[startProcessing, setProgress, setError, stopProcessing],
	);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				const selectedFile = files[0];
				setFile(selectedFile);
				clearError();
				setResult(null);

				if (isInstant) {
					processFile(selectedFile);
				}
			}
		},
		[isInstant, processFile, clearError],
	);

	const handleClear = useCallback(() => {
		setFile(null);
		clearError();
		setResult(null);
	}, [clearError]);

	const handleConvert = useCallback(async () => {
		if (!file) return;
		processFile(file);
	}, [file, processFile]);

	const handleDownload = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (result) {
				downloadBlob(result.blob, result.filename);
			}
		},
		[result],
	);

	const handleStartOver = useCallback(() => {
		setFile(null);
		setResult(null);
		clearError();
	}, [clearError]);

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<PdfPageHeader
				icon={<BookIcon className="w-7 h-7" />}
				iconClass="tool-convert"
				title="PDF to EPUB"
				description="Convert your PDF to ebook format with automatic chapter detection"
			/>

			{result ? (
				<SuccessCard
					stampText="Converted"
					title="EPUB Created!"
					subtitle={`${result.pageCount} pages · ${result.chapterCount} chapters · ${formatFileSize(result.blob.size)}`}
					downloadLabel="Download .epub"
					onDownload={handleDownload}
					onStartOver={handleStartOver}
					startOverLabel="Convert Another PDF"
				/>
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
							<p className="font-bold text-foreground mb-1">How it works</p>
							<p className="text-muted-foreground">
								Extracts text from your PDF and converts it to EPUB ebook
								format. Automatically detects headings and chapters. Works best
								with text-heavy PDFs like articles and books.
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
						<ProgressBar progress={progress} label="Converting to EPUB..." />
					)}

					<ProcessButton
						onClick={handleConvert}
						isProcessing={isProcessing}
						processingLabel="Converting..."
						icon={<BookIcon className="w-5 h-5" />}
						label="Convert to EPUB"
					/>
				</div>
			)}
		</div>
	);
}

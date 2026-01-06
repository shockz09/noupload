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
import {
	PDFA_DESCRIPTIONS,
	useGhostscript,
	type PdfALevel,
} from "@/lib/ghostscript/useGhostscript";
import { downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";

// Archive icon
function ArchiveIcon({ className }: { className?: string }) {
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
			<path d="M21 8v13H3V8" />
			<path d="M1 3h22v5H1z" />
			<path d="M10 12h4" />
		</svg>
	);
}

interface ConvertResult {
	data: Uint8Array;
	filename: string;
	originalSize: number;
	newSize: number;
	level: PdfALevel;
}

export default function PdfToPdfAPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const { toPdfA, progress: gsProgress } = useGhostscript();
	const [file, setFile] = useState<File | null>(null);
	const [pdfaLevel, setPdfaLevel] = useState<PdfALevel>("1b");
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ConvertResult | null>(null);
	const processingRef = useRef(false);
	const instantTriggeredRef = useRef(false);

	const processFile = useCallback(
		async (fileToProcess: File, level: PdfALevel = "1b") => {
			if (processingRef.current) return;
			processingRef.current = true;
			setIsProcessing(true);
			setError(null);
			setResult(null);

			try {
				const converted = await toPdfA(fileToProcess, level);

				const baseName = fileToProcess.name.replace(".pdf", "");
				setResult({
					data: converted,
					filename: `${baseName}_pdfa-${level}.pdf`,
					originalSize: fileToProcess.size,
					newSize: converted.length,
					level,
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to convert PDF");
			} finally {
				setIsProcessing(false);
				processingRef.current = false;
			}
		},
		[toPdfA],
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
			processFile(file, pdfaLevel);
		}
	}, [isInstant, file, isProcessing, result, processFile, pdfaLevel]);

	const handleClear = useCallback(() => {
		setFile(null);
		setError(null);
		setResult(null);
	}, []);

	const handleConvert = async () => {
		if (!file) return;
		processFile(file, pdfaLevel);
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
				icon={<ArchiveIcon className="w-7 h-7" />}
				iconClass="tool-pdfa"
				title="PDF to PDF/A"
				description="Convert to archival format for long-term preservation"
			/>

			{result ? (
				<SuccessCard
					stampText={`PDF/A-${result.level}`}
					title="Converted to PDF/A!"
					downloadLabel="Download PDF/A"
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

					{/* PDF/A Level Selector */}
					<div className="space-y-3">
						<label className="text-sm font-medium text-foreground">
							PDF/A Conformance Level
						</label>
						<div className="grid grid-cols-3 gap-3">
							{(["1b", "2b", "3b"] as PdfALevel[]).map((level) => (
								<button
									key={level}
									type="button"
									onClick={() => setPdfaLevel(level)}
									className={`p-3 rounded-lg border-2 transition-all text-left ${
										pdfaLevel === level
											? "border-primary bg-primary/5"
											: "border-border hover:border-muted-foreground/50"
									}`}
								>
									<div className="font-medium text-sm">PDF/A-{level}</div>
									<div className="text-xs text-muted-foreground mt-1">
										{level === "1b" && "Most compatible"}
										{level === "2b" && "Transparency"}
										{level === "3b" && "Attachments"}
									</div>
								</button>
							))}
						</div>
						<p className="text-xs text-muted-foreground">
							{PDFA_DESCRIPTIONS[pdfaLevel]}
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
								{isInstant ? "Instant conversion" : "About PDF/A"}
							</p>
							<p className="text-muted-foreground">
								{isInstant
									? "Drop a PDF and it will be converted automatically."
									: "PDF/A is an ISO standard for long-term archiving. Required by many government and legal systems."}
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

					{/* PDF/A Level Selector (when file selected) */}
					{!isProcessing && (
						<div className="space-y-3">
							<label className="text-sm font-medium text-foreground">
								PDF/A Conformance Level
							</label>
							<div className="grid grid-cols-3 gap-3">
								{(["1b", "2b", "3b"] as PdfALevel[]).map((level) => (
									<button
										key={level}
										type="button"
										onClick={() => setPdfaLevel(level)}
										className={`p-3 rounded-lg border-2 transition-all text-left ${
											pdfaLevel === level
												? "border-primary bg-primary/5"
												: "border-border hover:border-muted-foreground/50"
										}`}
									>
										<div className="font-medium text-sm">PDF/A-{level}</div>
										<div className="text-xs text-muted-foreground mt-1">
											{level === "1b" && "Most compatible"}
											{level === "2b" && "Transparency"}
											{level === "3b" && "Attachments"}
										</div>
									</button>
								))}
							</div>
						</div>
					)}

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
								<ArchiveIcon className="w-5 h-5" />
								Convert to PDF/A-{pdfaLevel}
							</>
						)}
					</button>
				</div>
			)}
		</div>
	);
}

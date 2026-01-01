"use client";

import { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, LoaderIcon } from "@/components/icons";

function ScanIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M3 7V5a2 2 0 0 1 2-2h2" />
			<path d="M17 3h2a2 2 0 0 1 2 2v2" />
			<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
			<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
			<line x1="7" y1="12" x2="17" y2="12" />
		</svg>
	);
}

function CopyIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="9" y="9" width="13" height="13" rx="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

function UploadIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
	);
}

const SCANNER_ID = "qr-scanner-element";

export default function QRScanPage() {
	const [isScanning, setIsScanning] = useState(false);
	const [scanResult, setScanResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [isProcessingFile, setIsProcessingFile] = useState(false);
	const scannerRef = useRef<Html5Qrcode | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Create scanner element outside React's control
	useEffect(() => {
		if (containerRef.current && !document.getElementById(SCANNER_ID)) {
			const scannerDiv = document.createElement("div");
			scannerDiv.id = SCANNER_ID;
			scannerDiv.style.width = "100%";
			scannerDiv.style.minHeight = "320px";
			containerRef.current.appendChild(scannerDiv);
		}

		return () => {
			// Cleanup scanner
			if (scannerRef.current) {
				scannerRef.current.stop().catch(() => {});
				scannerRef.current = null;
			}
			// Remove scanner element
			const el = document.getElementById(SCANNER_ID);
			if (el?.parentNode) {
				el.parentNode.removeChild(el);
			}
		};
	}, []);

	// Shared function to process a QR image file
	const processQRFile = useCallback(async (file: File) => {
		// Stop camera if running
		if (scannerRef.current) {
			try {
				await scannerRef.current.stop();
			} catch {}
			scannerRef.current = null;
			setIsScanning(false);
		}

		setError(null);
		setIsProcessingFile(true);

		try {
			const html5QrCode = new Html5Qrcode("qr-file-scanner");
			const result = await html5QrCode.scanFile(file, true);
			setScanResult(result);
			html5QrCode.clear();
		} catch {
			setError("No QR code found in image. Try another image.");
		} finally {
			setIsProcessingFile(false);
		}
	}, []);

	// Handle paste from clipboard
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items || scanResult) return;

			for (const item of items) {
				if (item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) processQRFile(file);
					break;
				}
			}
		};

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [scanResult, processQRFile]);

	const startScanning = async () => {
		setError(null);

		try {
			const html5QrCode = new Html5Qrcode(SCANNER_ID);
			scannerRef.current = html5QrCode;

			await html5QrCode.start(
				{ facingMode: "environment" },
				{ fps: 10 },
				async (decodedText) => {
					// IMPORTANT: Stop scanner FIRST, before any state changes
					try {
						await html5QrCode.stop();
					} catch {}
					scannerRef.current = null;
					// Only update state AFTER scanner is fully stopped
					setIsScanning(false);
					setScanResult(decodedText);
				},
				() => {}, // Ignore errors during scanning
			);
			setIsScanning(true);
		} catch (err) {
			scannerRef.current = null;
			setError(
				err instanceof Error
					? err.message
					: "Failed to access camera. Please allow camera permissions.",
			);
		}
	};

	const stopScanning = async () => {
		if (scannerRef.current) {
			try {
				await scannerRef.current.stop();
			} catch {}
			scannerRef.current = null;
		}
		setIsScanning(false);
	};

	const handleCopy = async () => {
		if (scanResult) {
			await navigator.clipboard.writeText(scanResult);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const isUrl = (text: string) => {
		try {
			new URL(text);
			return true;
		} catch {
			return false;
		}
	};

	const handleScanAnother = () => {
		setScanResult(null);
		setError(null);
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		processQRFile(file);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<div className="page-enter max-w-3xl mx-auto space-y-8">
			<Link
				href="/qr"
				className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeftIcon className="w-4 h-4" />
				Back to QR Tools
			</Link>

			<div className="flex items-start gap-6">
				<div
					className="tool-icon tool-qr-scan"
					style={{ width: 64, height: 64 }}
				>
					<ScanIcon className="w-7 h-7" />
				</div>
				<div>
					<h1 className="text-3xl sm:text-4xl font-display">Scan QR Code</h1>
					<p className="text-muted-foreground mt-2">
						Use your camera or upload an image
					</p>
				</div>
			</div>

			{/* Hidden elements */}
			<div id="qr-file-scanner" className="hidden" />
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={handleFileUpload}
				className="hidden"
			/>

			{!scanResult ? (
				<div className="space-y-6">
					{/* Camera View */}
					<div className="border-2 border-foreground bg-card overflow-hidden">
						<div
							ref={containerRef}
							className="relative bg-[#0A0A0A] overflow-hidden"
							style={{ minHeight: 340 }}
						>
							{!isScanning && (
								<div
									className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
									style={{ zIndex: 20 }}
								>
									<ScanIcon className="w-16 h-16 text-foreground/20 mb-4" />
									<p className="text-sm text-muted-foreground font-medium">
										Camera preview will appear here
									</p>
								</div>
							)}
							{isScanning && (
								<div
									className="absolute inset-3 pointer-events-none"
									style={{ zIndex: 20 }}
								>
									{/* Corner brackets - covers almost full area */}
									<div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary animate-pulse" />
									<div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary animate-pulse" />
									<div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary animate-pulse" />
									<div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary animate-pulse" />
									{/* Scan line */}
									<div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
								</div>
							)}
						</div>

						{/* Action bar */}
						<div className="p-4 border-t-2 border-foreground bg-card">
							<div className="flex gap-3">
								<button
									type="button"
									onClick={isScanning ? stopScanning : startScanning}
									disabled={isProcessingFile}
									className={`flex-1 ${isScanning ? "btn-secondary" : "btn-primary"}`}
								>
									{isScanning ? (
										<>
											<LoaderIcon className="w-5 h-5" />
											Stop
										</>
									) : (
										<>
											<ScanIcon className="w-5 h-5" />
											Start Camera
										</>
									)}
								</button>
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									disabled={isScanning || isProcessingFile}
									className="btn-secondary"
								>
									{isProcessingFile ? (
										<LoaderIcon className="w-5 h-5" />
									) : (
										<UploadIcon className="w-5 h-5" />
									)}
									<span className="hidden sm:inline">Upload</span>
								</button>
							</div>
						</div>
					</div>

					{error && (
						<div className="error-box animate-shake">
							<svg
								aria-hidden="true"
								className="w-5 h-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
							<span className="font-medium">{error}</span>
						</div>
					)}

					{/* Tips */}
					<div className="border-2 border-foreground/30 p-4">
						<div className="flex items-center gap-2 mb-3">
							<div className="w-1.5 h-4 bg-foreground" />
							<span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
								Tips
							</span>
						</div>
						<div className="grid sm:grid-cols-3 gap-4 text-sm">
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground/50 flex items-center justify-center shrink-0 mt-0.5">
									<ScanIcon className="w-3.5 h-3.5 text-muted-foreground" />
								</div>
								<div>
									<p className="font-bold">Camera</p>
									<p className="text-muted-foreground text-xs">
										Point at any QR code
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground/50 flex items-center justify-center shrink-0 mt-0.5">
									<UploadIcon className="w-3.5 h-3.5 text-muted-foreground" />
								</div>
								<div>
									<p className="font-bold">Upload</p>
									<p className="text-muted-foreground text-xs">
										Select image file
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<div className="w-6 h-6 border-2 border-foreground/50 flex items-center justify-center shrink-0 mt-0.5">
									<svg
										aria-hidden="true"
										className="w-3.5 h-3.5 text-muted-foreground"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<rect x="9" y="9" width="13" height="13" rx="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								</div>
								<div>
									<p className="font-bold">Paste</p>
									<p className="text-muted-foreground text-xs">
										Ctrl+V from clipboard
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="space-y-6 animate-fade-up">
					{/* Result Card */}
					<div className="border-2 border-foreground bg-card overflow-hidden">
						{/* Success header */}
						<div className="p-4 border-b-2 border-foreground bg-[#2D5A3D] text-white">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 border-2 border-white/30 flex items-center justify-center">
									<CheckIcon className="w-6 h-6" />
								</div>
								<div>
									<p className="text-xs font-bold tracking-wider uppercase opacity-80">
										Success
									</p>
									<p className="text-lg font-display">QR Code Decoded</p>
								</div>
							</div>
						</div>

						{/* Content */}
						<div className="p-6 space-y-6">
							<div>
								<div className="flex items-center gap-2 mb-2">
									<div className="w-1.5 h-4 bg-foreground" />
									<span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
										Content
									</span>
								</div>
								<div className="p-4 bg-muted border-2 border-foreground/30 font-mono text-sm break-all">
									{scanResult}
								</div>
							</div>

							{/* Type indicator */}
							<div className="flex items-center gap-2">
								<span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
									Type:
								</span>
								<span
									className={`px-2 py-1 text-xs font-bold border-2 ${isUrl(scanResult) ? "border-primary bg-primary/10 text-primary" : "border-foreground/30"}`}
								>
									{isUrl(scanResult) ? "URL" : "TEXT"}
								</span>
							</div>

							{/* Actions */}
							<div className="flex gap-3">
								{isUrl(scanResult) && (
									<a
										href={scanResult}
										target="_blank"
										rel="noopener noreferrer"
										className="btn-success flex-1 text-center"
									>
										<svg
											aria-hidden="true"
											className="w-5 h-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
										>
											<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
											<polyline points="15 3 21 3 21 9" />
											<line x1="10" y1="14" x2="21" y2="3" />
										</svg>
										Open Link
									</a>
								)}
								<button
									type="button"
									onClick={handleCopy}
									className={`flex-1 ${isUrl(scanResult) ? "btn-secondary" : "btn-success"}`}
									style={
										copied
											? { background: "#2D5A3D", color: "white" }
											: undefined
									}
								>
									{copied ? (
										<>
											<CheckIcon className="w-5 h-5" />
											Copied!
										</>
									) : (
										<>
											<CopyIcon className="w-5 h-5" />
											Copy
										</>
									)}
								</button>
							</div>
						</div>
					</div>

					<button
						type="button"
						onClick={handleScanAnother}
						className="btn-secondary w-full"
					>
						<ScanIcon className="w-5 h-5" />
						Scan Another Code
					</button>
				</div>
			)}
		</div>
	);
}

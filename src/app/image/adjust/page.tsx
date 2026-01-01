"use client";

import { useCallback, useEffect, useState } from "react";
import { BrightnessIcon, LoaderIcon } from "@/components/icons";
import {
	ErrorBox,
	ImagePageHeader,
	SuccessCard,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	adjustImage,
	copyImageToClipboard,
	downloadImage,
	formatFileSize,
	getOutputFilename,
} from "@/lib/image-utils";

export default function ImageAdjustPage() {
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [brightness, setBrightness] = useState(0);
	const [contrast, setContrast] = useState(0);
	const [saturation, setSaturation] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(
		null,
	);

	const handleFileSelected = useCallback((files: File[]) => {
		if (files.length > 0) {
			setFile(files[0]);
			setError(null);
			setResult(null);
			setBrightness(0);
			setContrast(0);
			setSaturation(0);
			setPreview(URL.createObjectURL(files[0]));
		}
	}, []);

	const handleClear = useCallback(() => {
		if (preview) URL.revokeObjectURL(preview);
		setFile(null);
		setPreview(null);
		setError(null);
		setResult(null);
		setBrightness(0);
		setContrast(0);
		setSaturation(0);
	}, [preview]);

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
					const f = item.getAsFile();
					if (f) handleFileSelected([f]);
					break;
				}
			}
		};
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [handleFileSelected]);

	const filterStyle = {
		filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`,
	};

	const hasChanges = brightness !== 0 || contrast !== 0 || saturation !== 0;

	const handleApply = async () => {
		if (!file) return;
		setIsProcessing(true);
		setError(null);
		try {
			const adjusted = await adjustImage(file, {
				brightness,
				contrast,
				saturation,
			});
			setResult({
				blob: adjusted,
				filename: getOutputFilename(file.name, undefined, "_adjusted"),
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to adjust image");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownload = (e: React.MouseEvent) => {
		e.preventDefault();
		if (result) downloadImage(result.blob, result.filename);
	};

	const handleStartOver = () => {
		if (preview) URL.revokeObjectURL(preview);
		setFile(null);
		setPreview(null);
		setResult(null);
		setError(null);
		setBrightness(0);
		setContrast(0);
		setSaturation(0);
	};

	const sliderClass =
		"w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer";

	return (
		<div className="page-enter max-w-4xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<BrightnessIcon className="w-7 h-7" />}
				iconClass="tool-adjust"
				title="Adjust Image"
				description="Fine-tune brightness, contrast, and saturation"
			/>

			{result ? (
				<SuccessCard
					stampText="Adjusted"
					title="Image Adjusted!"
					downloadLabel="Download Image"
					onDownload={handleDownload}
					onCopy={() => copyImageToClipboard(result.blob)}
					onStartOver={handleStartOver}
					startOverLabel="Adjust Another"
				>
					<p className="text-muted-foreground">
						File size: {formatFileSize(result.blob.size)}
					</p>
				</SuccessCard>
			) : !file ? (
				<FileDropzone
					accept=".jpg,.jpeg,.png,.webp"
					multiple={false}
					onFilesSelected={handleFileSelected}
					title="Drop your image here"
					subtitle="or click to browse · Ctrl+V to paste"
				/>
			) : (
				<div className="grid md:grid-cols-2 gap-6 overflow-hidden">
					{/* Left: Live Preview */}
					<div className="space-y-3 min-w-0">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
								Preview
							</span>
							<button
								type="button"
								onClick={handleClear}
								className="text-xs font-semibold text-muted-foreground hover:text-foreground"
							>
								Change file
							</button>
						</div>
						<div className="border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px] overflow-hidden">
							<img
								src={preview!}
								alt="Preview"
								style={filterStyle}
								className="max-h-[180px] max-w-full object-contain transition-all duration-100"
							/>
						</div>
						<p className="text-xs text-muted-foreground truncate">
							{file.name} • {formatFileSize(file.size)}
						</p>
					</div>

					{/* Right: Controls */}
					<div className="space-y-4 min-w-0">
						{/* Brightness */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
									Brightness
								</span>
								<span className="text-xs font-bold tabular-nums">
									{brightness > 0 ? `+${brightness}` : brightness}
								</span>
							</div>
							<input
								type="range"
								min="-100"
								max="100"
								value={brightness}
								onChange={(e) => setBrightness(Number(e.target.value))}
								className={sliderClass}
							/>
						</div>

						{/* Contrast */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
									Contrast
								</span>
								<span className="text-xs font-bold tabular-nums">
									{contrast > 0 ? `+${contrast}` : contrast}
								</span>
							</div>
							<input
								type="range"
								min="-100"
								max="100"
								value={contrast}
								onChange={(e) => setContrast(Number(e.target.value))}
								className={sliderClass}
							/>
						</div>

						{/* Saturation */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
									Saturation
								</span>
								<span className="text-xs font-bold tabular-nums">
									{saturation > 0 ? `+${saturation}` : saturation}
								</span>
							</div>
							<input
								type="range"
								min="-100"
								max="100"
								value={saturation}
								onChange={(e) => setSaturation(Number(e.target.value))}
								className={sliderClass}
							/>
						</div>

						{/* Reset */}
						{hasChanges && (
							<button
								type="button"
								onClick={() => {
									setBrightness(0);
									setContrast(0);
									setSaturation(0);
								}}
								className="text-xs font-semibold text-muted-foreground hover:text-foreground"
							>
								Reset all adjustments
							</button>
						)}

						{error && <ErrorBox message={error} />}

						{/* Action Button */}
						<button
							type="button"
							onClick={handleApply}
							disabled={isProcessing || !hasChanges}
							className="btn-primary w-full"
						>
							{isProcessing ? (
								<>
									<LoaderIcon className="w-5 h-5" />
									Processing...
								</>
							) : (
								<>
									<BrightnessIcon className="w-5 h-5" />
									Apply Adjustments
								</>
							)}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

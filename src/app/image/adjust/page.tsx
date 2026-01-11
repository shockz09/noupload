"use client";

import { useCallback, useMemo, useState } from "react";
import { BrightnessIcon, LoaderIcon } from "@/components/icons";
import {
	ErrorBox,
	ImagePageHeader,
	SuccessCard,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	useFileProcessing,
	useImagePaste,
	useObjectURL,
	useProcessingResult,
} from "@/hooks";
import {
	adjustImage,
	copyImageToClipboard,
	formatFileSize,
	getOutputFilename,
} from "@/lib/image-utils";

const sliderClass =
	"w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer";

export default function ImageAdjustPage() {
	const [file, setFile] = useState<File | null>(null);
	const [brightness, setBrightness] = useState(0);
	const [contrast, setContrast] = useState(0);
	const [saturation, setSaturation] = useState(0);

	// Use custom hooks
	const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
	const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();
	const { result, setResult, clearResult, download } = useProcessingResult();

	const handleFileSelected = useCallback((files: File[]) => {
		if (files.length > 0) {
			setFile(files[0]);
			clearResult();
			setBrightness(0);
			setContrast(0);
			setSaturation(0);
			setPreview(files[0]);
		}
	}, [clearResult, setPreview]);

	// Use clipboard paste hook
	useImagePaste(handleFileSelected, !result);

	const handleClear = useCallback(() => {
		revokePreview();
		setFile(null);
		clearResult();
		setBrightness(0);
		setContrast(0);
		setSaturation(0);
	}, [revokePreview, clearResult]);

	const filterStyle = useMemo(() => ({
		filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`,
	}), [brightness, contrast, saturation]);

	const hasChanges = useMemo(() =>
		brightness !== 0 || contrast !== 0 || saturation !== 0,
		[brightness, contrast, saturation]
	);

	const handleApply = useCallback(async () => {
		if (!file) return;
		if (!startProcessing()) return;

		try {
			const adjusted = await adjustImage(file, {
				brightness,
				contrast,
				saturation,
			});
			setResult(adjusted, getOutputFilename(file.name, undefined, "_adjusted"));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to adjust image");
		} finally {
			stopProcessing();
		}
	}, [file, brightness, contrast, saturation, startProcessing, setResult, setError, stopProcessing]);

	const handleDownload = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		download();
	}, [download]);

	const handleStartOver = useCallback(() => {
		revokePreview();
		setFile(null);
		clearResult();
		setBrightness(0);
		setContrast(0);
		setSaturation(0);
	}, [revokePreview, clearResult]);

	const handleBrightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setBrightness(Number(e.target.value));
	}, []);

	const handleContrastChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setContrast(Number(e.target.value));
	}, []);

	const handleSaturationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setSaturation(Number(e.target.value));
	}, []);

	const handleReset = useCallback(() => {
		setBrightness(0);
		setContrast(0);
		setSaturation(0);
	}, []);

	const formatValue = useCallback((val: number) =>
		val > 0 ? `+${val}` : String(val),
		[]
	);

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
								loading="lazy"
								decoding="async"
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
									{formatValue(brightness)}
								</span>
							</div>
							<input
								type="range"
								min="-100"
								max="100"
								value={brightness}
								onChange={handleBrightnessChange}
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
									{formatValue(contrast)}
								</span>
							</div>
							<input
								type="range"
								min="-100"
								max="100"
								value={contrast}
								onChange={handleContrastChange}
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
									{formatValue(saturation)}
								</span>
							</div>
							<input
								type="range"
								min="-100"
								max="100"
								value={saturation}
								onChange={handleSaturationChange}
								className={sliderClass}
							/>
						</div>

						{/* Reset */}
						{hasChanges && (
							<button
								type="button"
								onClick={handleReset}
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

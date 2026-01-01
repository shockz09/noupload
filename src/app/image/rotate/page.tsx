"use client";

import { useCallback, useEffect, useState } from "react";
import {
	FlipHorizontalIcon,
	FlipVerticalIcon,
	LoaderIcon,
	RotateIcon,
} from "@/components/icons";
import {
	ErrorBox,
	ImagePageHeader,
	SuccessCard,
} from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import {
	copyImageToClipboard,
	downloadImage,
	flipImage,
	formatFileSize,
	getOutputFilename,
	rotateImage,
} from "@/lib/image-utils";

type Rotation = 0 | 90 | 180 | 270;

export default function ImageRotatePage() {
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [rotation, setRotation] = useState<Rotation>(0);
	const [flipH, setFlipH] = useState(false);
	const [flipV, setFlipV] = useState(false);
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
			setRotation(0);
			setFlipH(false);
			setFlipV(false);
			setPreview(URL.createObjectURL(files[0]));
		}
	}, []);

	const handleClear = useCallback(() => {
		if (preview) URL.revokeObjectURL(preview);
		setFile(null);
		setPreview(null);
		setError(null);
		setResult(null);
		setRotation(0);
		setFlipH(false);
		setFlipV(false);
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

	const rotateLeft = () =>
		setRotation((prev) => ((prev - 90 + 360) % 360) as Rotation);
	const rotateRight = () =>
		setRotation((prev) => ((prev + 90) % 360) as Rotation);

	const handleApply = async () => {
		if (!file) return;
		setIsProcessing(true);
		setError(null);
		try {
			let blob: Blob = file;
			if (rotation !== 0) blob = await rotateImage(file, rotation);
			if (flipH)
				blob = await flipImage(
					new File([blob], file.name, { type: blob.type }),
					"horizontal",
				);
			if (flipV)
				blob = await flipImage(
					new File([blob], file.name, { type: blob.type }),
					"vertical",
				);
			setResult({
				blob,
				filename: getOutputFilename(file.name, undefined, "_transformed"),
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to transform image",
			);
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
		setRotation(0);
		setFlipH(false);
		setFlipV(false);
	};

	const hasChanges = rotation !== 0 || flipH || flipV;
	const previewStyle = {
		transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
	};

	return (
		<div className="page-enter max-w-4xl mx-auto space-y-8">
			<ImagePageHeader
				icon={<RotateIcon className="w-7 h-7" />}
				iconClass="tool-rotate-image"
				title="Rotate & Flip"
				description="Rotate 90°, 180°, 270° or flip your images"
			/>

			{result ? (
				<SuccessCard
					stampText="Done"
					title="Image Transformed!"
					downloadLabel="Download Image"
					onDownload={handleDownload}
					onCopy={() => copyImageToClipboard(result.blob)}
					onStartOver={handleStartOver}
					startOverLabel="Transform Another"
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
				<div className="grid md:grid-cols-2 gap-6">
					{/* Left: Live Preview */}
					<div className="space-y-3">
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
						<div
							role="button"
							tabIndex={0}
							onClick={rotateRight}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									rotateRight();
								}
							}}
							className="relative border-2 border-foreground p-2 bg-muted/30 flex justify-center items-center min-h-[200px] overflow-hidden cursor-pointer group"
							title="Click to rotate"
						>
							<img
								src={preview!}
								alt="Preview"
								style={previewStyle}
								className="max-h-[180px] object-contain transition-transform duration-200 group-hover:scale-[1.02]"
							/>
							<div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
								Click to rotate →
							</div>
						</div>
						<p className="text-xs text-muted-foreground truncate">
							{file.name} • {formatFileSize(file.size)}
						</p>
					</div>

					{/* Right: Controls */}
					<div className="space-y-4">
						{/* Rotate */}
						<div className="space-y-2">
							<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
								Rotate
							</span>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={rotateLeft}
									className="flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
								>
									<svg
										aria-hidden="true"
										className="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
										<path d="M3 3v5h5" />
									</svg>
									Left
								</button>
								<button
									type="button"
									onClick={rotateRight}
									className="flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm hover:bg-foreground hover:text-background transition-colors flex items-center justify-center gap-2"
								>
									<svg
										aria-hidden="true"
										className="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
										<path d="M21 3v5h-5" />
									</svg>
									Right
								</button>
							</div>
							{rotation !== 0 && (
								<p className="text-xs text-center text-muted-foreground">
									Rotation: {rotation}°
								</p>
							)}
						</div>

						{/* Flip */}
						<div className="space-y-2">
							<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
								Flip
							</span>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setFlipH(!flipH)}
									className={`flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
										flipH
											? "bg-foreground text-background"
											: "hover:bg-foreground hover:text-background"
									}`}
								>
									<FlipHorizontalIcon className="w-4 h-4" />
									Horizontal
								</button>
								<button
									type="button"
									onClick={() => setFlipV(!flipV)}
									className={`flex-1 px-3 py-2.5 border-2 border-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
										flipV
											? "bg-foreground text-background"
											: "hover:bg-foreground hover:text-background"
									}`}
								>
									<FlipVerticalIcon className="w-4 h-4" />
									Vertical
								</button>
							</div>
						</div>

						{/* Status */}
						{hasChanges && (
							<div className="flex items-center justify-between p-3 bg-muted/50 border border-foreground/10">
								<p className="text-xs text-muted-foreground">
									Changes:{" "}
									{[
										rotation !== 0 && `${rotation}°`,
										flipH && "H-flip",
										flipV && "V-flip",
									]
										.filter(Boolean)
										.join(", ")}
								</p>
								<button
									type="button"
									onClick={() => {
										setRotation(0);
										setFlipH(false);
										setFlipV(false);
									}}
									className="text-xs font-semibold text-muted-foreground hover:text-foreground"
								>
									Reset
								</button>
							</div>
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
									<RotateIcon className="w-5 h-5" />
									Apply Changes
								</>
							)}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

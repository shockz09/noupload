import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/merge")({
	head: () => ({
		meta: [
			{ title: "Merge Video Free - Combine Video Files Online | noupload" },
			{ name: "description", content: "Merge multiple video files for free. Combine MP4, MOV, WebM, MKV into one video. Reorder clips. Works offline, completely private." },
			{ name: "keywords", content: "merge video, combine video, video merger, join video files, concatenate video, splice video, free video merger" },
			{ property: "og:title", content: "Merge Video Free - Combine Video Files Online" },
			{ property: "og:description", content: "Merge multiple video files for free. Works 100% offline." },
		],
	}),
	component: MergeVideoPage,
});

import { useCallback, useMemo, useRef, useState } from "react";
import { GripIcon, XIcon } from "@/components/icons/ui";
import { VideoMergeIcon, VideoToolIcon } from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { ErrorBox, InfoBox, ProgressBar, VideoPageHeader, VideoResultView } from "@/components/video/shared";
import { useFileBuffer, useFileProcessing } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize } from "@/lib/utils";
import { analyzeVideo, type VideoInfo } from "@/lib/video/compress";
import { mergeVideos, type MergeFileInfo } from "@/lib/video/merge";
import { MEDIABUNNY_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS, VIDEO_MAX_FILE_SIZE } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────

interface FileItem {
	id: string;
	file: File;
	info: VideoInfo | null;
	loading: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

function fmtDur(s: number): string {
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────

function MergeVideoPage() {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const { isProcessing, progress, error, startProcessing, stopProcessing, setProgress, setError, clearError } =
		useFileProcessing();

	// ── Derived ──────────────────────────────────────────────

	const allAnalyzed = files.length >= 2 && files.every((f) => !f.loading && f.info !== null);
	const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.file.size, 0), [files]);
	const totalDuration = useMemo(
		() => files.reduce((sum, f) => sum + (f.info?.duration ?? 0), 0),
		[files],
	);

	// ── File analysis ────────────────────────────────────────

	const analyzeFile = useCallback(async (file: File, id: string) => {
		try {
			const info = await analyzeVideo(file);
			setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, info, loading: false } : f)));
		} catch {
			setFiles((prev) =>
				prev.map((f) =>
					f.id === id
						? { ...f, loading: false, info: null }
						: f,
				),
			);
		}
	}, []);

	const handleFilesSelected = useCallback(
		(selectedFiles: File[]) => {
			if (!selectedFiles.length) return;
			setResult(null);
			clearError();

			const newItems: FileItem[] = selectedFiles.map((file) => ({
				id: crypto.randomUUID(),
				file,
				info: null,
				loading: true,
			}));

			setFiles((prev) => [...prev, ...newItems]);

			for (const item of newItems) {
				analyzeFile(item.file, item.id);
			}
		},
		[clearError, analyzeFile],
	);

	const handleRemoveFile = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	// ── Drag-to-reorder ──────────────────────────────────────

	const handleDragStart = useCallback((index: number) => {
		setDraggedIndex(index);
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, index: number) => {
			e.preventDefault();
			if (draggedIndex === null || draggedIndex === index) return;

			setFiles((prev) => {
				const next = [...prev];
				const dragged = next[draggedIndex];
				next.splice(draggedIndex, 1);
				next.splice(index, 0, dragged);
				return next;
			});
			setDraggedIndex(index);
		},
		[draggedIndex],
	);

	const handleDragEnd = useCallback(() => {
		setDraggedIndex(null);
	}, []);

	// ── Processing ────────────────────────────────────────────

	const process = useCallback(async () => {
		if (files.length < 2) {
			setError("Please add at least 2 video files to merge");
			return;
		}
		if (!allAnalyzed) {
			setError("Please wait for all files to be analyzed");
			return;
		}

		if (!startProcessing()) return;
		setResult(null);

		try {
			const items: MergeFileInfo[] = files
				.filter((f) => f.info !== null)
				.map((f) => ({ file: f.file, info: f.info! }));

			const r = await mergeVideos(items, (p) => setProgress(p * 100));
			setResult(r);
		} catch (err) {
			setError(getErrorMessage(err, "Failed to merge videos"));
		} finally {
			stopProcessing();
		}
	}, [files, allAnalyzed, startProcessing, setProgress, setError, stopProcessing]);

	const processRef = useRef(process);
	processRef.current = process;

	// ── Download / Buffer ─────────────────────────────────────

	const download = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			if (result) downloadBlob(result.blob, result.filename, "video/mp4");
		},
		[result],
	);

	const reset = useCallback(() => {
		setFiles([]);
		setResult(null);
		setDraggedIndex(null);
		clearError();
	}, [clearError]);

	const { add: addToBuffer } = useFileBuffer();
	const holdInBuffer = useCallback(() => {
		if (!result) return;
		addToBuffer({
			filename: result.filename,
			blob: result.blob,
			mimeType: "video/mp4",
			size: result.blob.size,
			fileType: "video",
			sourceToolLabel: "Merge Video",
		});
	}, [result, addToBuffer]);

	// ── Render ────────────────────────────────────────────────

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<VideoPageHeader
				icon={<VideoMergeIcon className="w-7 h-7" />}
				iconClass="tool-video-merge"
				title="Merge Video"
				description="Combine multiple video files into one"
			/>

			{result ? (
				<VideoResultView
					blob={result.blob}
					title="Videos Merged!"
					subtitle={`${files.length} clips · ${fmtDur(totalDuration)}`}
					downloadLabel="Download Merged Video"
					onDownload={download}
					onHoldInBuffer={holdInBuffer}
					onStartOver={reset}
					startOverLabel="Merge More Videos"
				/>
			) : (
				<div className="space-y-4">
					<FileDropzone
						accept={VIDEO_EXTENSIONS}
						multiple={true}
						maxSize={VIDEO_MAX_FILE_SIZE}
						onFilesSelected={handleFilesSelected}
						title={files.length > 0 ? "Add more video files" : "Drop your video files here"}
						subtitle="MP4, MOV, WebM, MKV"
					/>

					{/* ── File list ── */}
					{files.length > 0 && (
						<div className="border-2 border-foreground bg-card">
							<div className="px-4 py-2 border-b border-foreground/20 flex items-center justify-between">
								<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
									{files.length} files · {formatFileSize(totalSize)}
									{totalDuration > 0 && <> · {fmtDur(totalDuration)}</>}
								</span>
								<span className="text-xs text-muted-foreground">Drag to reorder</span>
							</div>
							<div className="divide-y divide-foreground/10">
								{files.map((item, index) => (
									<div
										key={item.id}
										draggable={!isProcessing}
										onDragStart={() => handleDragStart(index)}
										onDragOver={(e) => handleDragOver(e, index)}
										onDragEnd={handleDragEnd}
										className={`flex items-center gap-3 p-3 transition-colors ${
											isProcessing ? "" : "cursor-grab active:cursor-grabbing"
										} ${draggedIndex === index ? "bg-muted/50" : "hover:bg-muted/30"}`}
									>
										{!isProcessing && <GripIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
										<span className="w-6 h-6 flex items-center justify-center bg-foreground text-background text-xs font-bold shrink-0">
											{index + 1}
										</span>
										<VideoToolIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">{item.file.name}</p>
											<p className="text-xs text-muted-foreground">
												{formatFileSize(item.file.size)}
												{item.loading && " · Analyzing..."}
												{item.info && !item.loading && (
													<>
														{" · "}
														{fmtDur(item.info.duration)}
														{" · "}
														{item.info.width}×{item.info.height}
													</>
												)}
											</p>
										</div>
										{!isProcessing && (
											<button
												type="button"
												onClick={() => handleRemoveFile(item.id)}
												className="p-1 text-muted-foreground hover:text-foreground"
											>
												<XIcon className="w-4 h-4" />
											</button>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{files.length >= 2 && (
						<InfoBox>
							Videos will be re-encoded to match the first file's resolution and combined in order.
						</InfoBox>
					)}

					{error && <ErrorBox message={error} />}

					{isProcessing && (
						<ProgressBar
							progress={progress}
							label={`Merging ${files.length} videos...`}
						/>
					)}

					{files.length >= 2 && (
						<button
							type="button"
							onClick={process}
							disabled={isProcessing || !allAnalyzed}
							className="btn-primary w-full"
						>
							{isProcessing ? (
								<>
									<span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									Merging... {Math.round(progress)}%
								</>
							) : (
								<>
									<VideoMergeIcon className="w-5 h-5" />
									Merge {files.length} Videos
								</>
							)}
						</button>
					)}

					{files.length === 1 && (
						<p className="text-center text-sm text-muted-foreground">Add at least one more video to merge</p>
					)}
				</div>
			)}
		</div>
	);
}

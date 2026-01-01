"use client";

import { useCallback, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
	AudioFileInfo,
	AudioPageHeader,
	ErrorBox,
	FFmpegNotice,
	ProcessButton,
	ProgressBar,
	SuccessCard,
	VideoExtractionProgress,
} from "@/components/audio/shared";
import { NormalizeIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";
import {
	isFFmpegLoaded,
	type NormalizePreset,
	normalizeAudio,
} from "@/lib/ffmpeg-utils";

const presets: {
	value: NormalizePreset;
	label: string;
	desc: string;
	lufs: string;
}[] = [
	{
		value: "spotify",
		label: "Spotify",
		desc: "Music streaming",
		lufs: "-14 LUFS",
	},
	{
		value: "youtube",
		label: "YouTube",
		desc: "Video platform",
		lufs: "-14 LUFS",
	},
	{
		value: "podcast",
		label: "Podcast",
		desc: "Voice content",
		lufs: "-16 LUFS",
	},
	{
		value: "broadcast",
		label: "Broadcast",
		desc: "TV/Radio standard",
		lufs: "-23 LUFS",
	},
];

type ProcessingState = "idle" | "loading-ffmpeg" | "normalizing";

export default function NormalizeAudioPage() {
	const { isInstant, isLoaded } = useInstantMode();
	const [file, setFile] = useState<File | null>(null);
	const [duration, setDuration] = useState(0);
	const [preset, setPreset] = useState<NormalizePreset>("podcast");
	const [usedPreset, setUsedPreset] = useState<NormalizePreset>("podcast");
	const [processingState, setProcessingState] =
		useState<ProcessingState>("idle");
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const { result, setResult, clearResult, download } = useAudioResult();
	const {
		processFileSelection,
		extractionState,
		extractionProgress,
		isExtracting,
		videoFilename,
	} = useVideoToAudio();
	const processingRef = useRef(false);

	const processFile = useCallback(
		async (fileToProcess: File, targetPreset: NormalizePreset) => {
			if (processingRef.current) return;
			processingRef.current = true;
			setError(null);
			setProgress(0);

			try {
				if (!isFFmpegLoaded()) {
					setProcessingState("loading-ffmpeg");
				}

				setProcessingState("normalizing");

				const blob = await normalizeAudio(fileToProcess, targetPreset, (p) =>
					setProgress(p),
				);

				const baseName = fileToProcess.name.split(".").slice(0, -1).join(".");
				setResult(blob, `${baseName}_normalized.wav`);
				setUsedPreset(targetPreset);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to normalize audio",
				);
			} finally {
				setProcessingState("idle");
				processingRef.current = false;
			}
		},
		[setResult],
	);

	const handleAudioReady = useCallback(
		async (files: File[]) => {
			if (files.length > 0) {
				const selectedFile = files[0];
				setFile(selectedFile);
				setError(null);
				clearResult();

				try {
					const info = await getAudioInfo(selectedFile);
					setDuration(info.duration);
				} catch {
					// Duration not critical
				}

				if (isInstant) {
					processFile(selectedFile, "podcast"); // -16 LUFS default
				}
			}
		},
		[isInstant, processFile, clearResult],
	);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			processFileSelection(files, handleAudioReady);
		},
		[processFileSelection, handleAudioReady],
	);

	const handleNormalize = async () => {
		if (!file) return;
		processFile(file, preset);
	};

	const handleStartOver = () => {
		clearResult();
		setFile(null);
		setError(null);
		setProgress(0);
		setDuration(0);
	};

	const isProcessing = processingState !== "idle";
	const _selectedPreset = presets.find((p) => p.value === preset);
	const usedPresetInfo = presets.find((p) => p.value === usedPreset);

	if (!isLoaded) return null;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<AudioPageHeader
				icon={<NormalizeIcon className="w-7 h-7" />}
				iconClass="tool-audio-normalize"
				title="Normalize Audio"
				description="Make audio volume consistent for any platform"
			/>

			{result ? (
				<SuccessCard
					stampText="Normalized"
					title="Audio Normalized!"
					subtitle={`Target: ${usedPresetInfo?.label} (${usedPresetInfo?.lufs}) | ${formatFileSize(result.blob.size)}`}
					downloadLabel="Download Normalized Audio"
					onDownload={download}
					onStartOver={handleStartOver}
					startOverLabel="Normalize Another"
				>
					<AudioPlayer src={result.url} />
				</SuccessCard>
			) : isExtracting ? (
				<VideoExtractionProgress
					state={extractionState}
					progress={extractionProgress}
					filename={videoFilename}
				/>
			) : !file ? (
				<FileDropzone
					accept={AUDIO_VIDEO_EXTENSIONS}
					multiple={false}
					onFilesSelected={handleFileSelected}
					title="Drop your audio or video file here"
					subtitle="MP3, WAV, OGG, M4A, MP4, MOV, etc."
				/>
			) : (
				<div className="space-y-4">
					<AudioFileInfo
						file={file}
						duration={duration}
						onClear={handleStartOver}
					/>

					{/* Preset Selection */}
					<div className="border-2 border-foreground p-4 bg-card space-y-3">
						<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
							Target Platform
						</span>
						<div className="grid grid-cols-2 gap-2">
							{presets.map((p) => (
								<button
									type="button"
									key={p.value}
									onClick={() => setPreset(p.value)}
									className={`p-3 border-2 text-left transition-all ${
										preset === p.value
											? "border-foreground bg-foreground text-background"
											: "border-foreground/30 hover:border-foreground"
									}`}
								>
									<span className="block font-bold">{p.label}</span>
									<span
										className={`block text-xs ${preset === p.value ? "text-background/70" : "text-muted-foreground"}`}
									>
										{p.desc} • {p.lufs}
									</span>
								</button>
							))}
						</div>
					</div>

					{!isFFmpegLoaded() && <FFmpegNotice />}

					{error && <ErrorBox message={error} />}

					{isProcessing && (
						<ProgressBar
							progress={progress}
							label={
								processingState === "loading-ffmpeg"
									? "Loading audio engine..."
									: "Normalizing..."
							}
						/>
					)}

					<ProcessButton
						onClick={handleNormalize}
						isProcessing={isProcessing}
						processingLabel={
							processingState === "loading-ffmpeg"
								? "Loading..."
								: "Normalizing..."
						}
						icon={<NormalizeIcon className="w-5 h-5" />}
						label="Normalize Audio"
					/>
				</div>
			)}
		</div>
	);
}

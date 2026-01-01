"use client";

import { useCallback, useEffect, useState } from "react";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import {
	AudioFileInfo,
	AudioPageHeader,
	ErrorBox,
	ProcessButton,
	SuccessCard,
	VideoExtractionProgress,
} from "@/components/audio/shared";
import { SpeedIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import {
	changeSpeed,
	formatDuration,
	formatFileSize,
	getAudioInfo,
} from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";

const speedPresets = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function SpeedAudioPage() {
	const [file, setFile] = useState<File | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [duration, setDuration] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [usedSpeed, setUsedSpeed] = useState(1);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { result, setResult, clearResult, download } = useAudioResult();
	const {
		processFileSelection,
		extractionState,
		extractionProgress,
		isExtracting,
		videoFilename,
	} = useVideoToAudio();

	useEffect(() => {
		return () => {
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		};
	}, [audioUrl]);

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
					const url = URL.createObjectURL(selectedFile);
					if (audioUrl) URL.revokeObjectURL(audioUrl);
					setAudioUrl(url);
				} catch {
					setError("Failed to load audio file.");
				}
			}
		},
		[audioUrl, clearResult],
	);

	const handleFileSelected = useCallback(
		(files: File[]) => {
			processFileSelection(files, handleAudioReady);
		},
		[processFileSelection, handleAudioReady],
	);

	const handleProcess = async () => {
		if (!file) return;
		setIsProcessing(true);
		setError(null);

		try {
			const processed = await changeSpeed(file, speed);
			const baseName = file.name.split(".").slice(0, -1).join(".");
			setResult(processed, `${baseName}_${speed}x.wav`);
			setUsedSpeed(speed);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to change speed");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleStartOver = () => {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		clearResult();
		setFile(null);
		setAudioUrl(null);
		setError(null);
		setSpeed(1);
	};

	const newDuration = duration / speed;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<AudioPageHeader
				icon={<SpeedIcon className="w-7 h-7" />}
				iconClass="tool-audio-speed"
				title="Change Speed"
				description="Speed up or slow down audio"
			/>

			{result ? (
				<SuccessCard
					stampText="Done"
					title="Speed Changed!"
					subtitle={`${usedSpeed}x speed • ${formatDuration(duration / usedSpeed)} • ${formatFileSize(result.blob.size)}`}
					downloadLabel="Download Audio"
					onDownload={download}
					onStartOver={handleStartOver}
					startOverLabel="Process Another"
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
				<div className="space-y-6">
					<AudioFileInfo
						file={file}
						duration={duration}
						onClear={handleStartOver}
					/>

					{audioUrl && <AudioPlayer src={audioUrl} />}

					<div className="space-y-3">
						<span className="input-label">Speed</span>
						<div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
							{speedPresets.map((s) => (
								<button
									type="button"
									key={s}
									onClick={() => setSpeed(s)}
									className={`px-2 sm:px-3 py-2 text-sm font-bold border-2 border-foreground transition-colors ${
										speed === s
											? "bg-foreground text-background"
											: "hover:bg-muted"
									}`}
								>
									{s}x
								</button>
							))}
						</div>
					</div>

					<div className="bg-muted/50 border-2 border-foreground p-4">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Original duration:</span>
							<span className="font-bold">{formatDuration(duration)}</span>
						</div>
						<div className="flex justify-between text-sm mt-1">
							<span className="text-muted-foreground">New duration:</span>
							<span className="font-bold">{formatDuration(newDuration)}</span>
						</div>
					</div>

					{error && <ErrorBox message={error} />}

					<ProcessButton
						onClick={handleProcess}
						disabled={speed === 1}
						isProcessing={isProcessing}
						processingLabel="Processing..."
						icon={<SpeedIcon className="w-5 h-5" />}
						label={`Change Speed to ${speed}x`}
					/>
				</div>
			)}
		</div>
	);
}

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
import { VolumeIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { useAudioResult, useVideoToAudio } from "@/hooks";
import { adjustVolume, formatFileSize, getAudioInfo } from "@/lib/audio-utils";
import { AUDIO_VIDEO_EXTENSIONS } from "@/lib/constants";

export default function VolumeAudioPage() {
	const [file, setFile] = useState<File | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(100);
	const [usedVolume, setUsedVolume] = useState(100);
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
			const processed = await adjustVolume(file, volume / 100);
			const baseName = file.name.split(".").slice(0, -1).join(".");
			setResult(processed, `${baseName}_volume.wav`);
			setUsedVolume(volume);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to adjust volume");
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
		setVolume(100);
	};

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-8">
			<AudioPageHeader
				icon={<VolumeIcon className="w-7 h-7" />}
				iconClass="tool-audio-volume"
				title="Adjust Volume"
				description="Increase or decrease audio volume"
			/>

			{result ? (
				<SuccessCard
					stampText="Done"
					title="Volume Adjusted!"
					subtitle={`${usedVolume}% volume • ${formatFileSize(result.blob.size)}`}
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
						<div className="flex items-center justify-between">
							<span className="input-label">Volume</span>
							<span className="text-sm font-bold">{volume}%</span>
						</div>
						<input
							type="range"
							min="0"
							max="300"
							value={volume}
							onChange={(e) => setVolume(Number(e.target.value))}
							className="w-full h-2 bg-muted border-2 border-foreground appearance-none cursor-pointer"
						/>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>Mute</span>
							<span>Normal</span>
							<span>3x Louder</span>
						</div>
					</div>

					{error && <ErrorBox message={error} />}

					<ProcessButton
						onClick={handleProcess}
						isProcessing={isProcessing}
						processingLabel="Processing..."
						icon={<VolumeIcon className="w-5 h-5" />}
						label="Adjust Volume"
					/>
				</div>
			)}
		</div>
	);
}

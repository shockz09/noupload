"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWaveformDataFromUrl } from "@/lib/audio-utils";

interface AudioPlayerProps {
	src: string;
	className?: string;
}

const WAVEFORM_BARS = 80;

export function AudioPlayer({ src, className = "" }: AudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const progressRef = useRef<HTMLDivElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const [waveform, setWaveform] = useState<number[]>([]);
	const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);

	// Load waveform data when src changes
	useEffect(() => {
		if (!src) return;

		let cancelled = false;
		setIsLoadingWaveform(true);

		getWaveformDataFromUrl(src, WAVEFORM_BARS)
			.then((data) => {
				if (!cancelled) {
					setWaveform(data);
					setIsLoadingWaveform(false);
				}
			})
			.catch(() => {
				if (!cancelled) {
					// Fallback to empty waveform on error
					setWaveform([]);
					setIsLoadingWaveform(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [src]);

	// Format time as MM:SS
	const formatTime = (seconds: number) => {
		if (!Number.isFinite(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Play/Pause toggle
	const togglePlay = () => {
		if (!audioRef.current) return;
		if (isPlaying) {
			audioRef.current.pause();
		} else {
			audioRef.current.play();
		}
		setIsPlaying(!isPlaying);
	};

	// Handle time update
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleTimeUpdate = () => {
			if (!isDragging) setCurrentTime(audio.currentTime);
		};
		const handleLoadedMetadata = () => setDuration(audio.duration);
		const handleEnded = () => setIsPlaying(false);

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("loadedmetadata", handleLoadedMetadata);
		audio.addEventListener("ended", handleEnded);

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audio.removeEventListener("ended", handleEnded);
		};
	}, [isDragging]);

	// Seek to position
	const seekTo = useCallback(
		(clientX: number) => {
			if (!progressRef.current || !audioRef.current) return;
			const rect = progressRef.current.getBoundingClientRect();
			const percent = Math.max(
				0,
				Math.min(1, (clientX - rect.left) / rect.width),
			);
			const newTime = percent * duration;
			audioRef.current.currentTime = newTime;
			setCurrentTime(newTime);
		},
		[duration],
	);

	const handleProgressClick = (e: React.MouseEvent) => seekTo(e.clientX);
	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true);
		seekTo(e.clientX);
	};

	useEffect(() => {
		if (!isDragging) return;
		const handleMouseMove = (e: MouseEvent) => seekTo(e.clientX);
		const handleMouseUp = () => setIsDragging(false);
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, seekTo]);

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

	// Get bar height from waveform data or fallback
	const getBarHeight = (index: number) => {
		if (waveform.length > 0 && waveform[index] !== undefined) {
			// Use real waveform data, scale to reasonable visual range
			return 0.15 + waveform[index] * 0.7;
		}
		// Fallback: subtle flat bars while loading
		return 0.2;
	};

	return (
		<div className={`bg-card ${className}`}>
			<audio ref={audioRef} src={src} preload="metadata" />

			{/* Main Player Container */}
			<div className="border-2 border-foreground">
				<div className="flex items-stretch">
					{/* Play/Pause Button - The Hero */}
					<button
						type="button"
						onClick={togglePlay}
						className={`
              w-16 h-16 border-r-2 border-foreground flex items-center justify-center
              transition-all duration-100 relative group
              ${
								isPlaying
									? "bg-foreground text-background"
									: "bg-background text-foreground hover:bg-foreground hover:text-background"
							}
            `}
					>
						{/* Button press effect */}
						<div
							className={`
              absolute inset-0 border-b-4 border-r-4 border-foreground/20
              transition-all duration-75
              ${isPlaying ? "border-b-0 border-r-0" : "group-hover:border-b-2 group-hover:border-r-2 group-active:border-b-0 group-active:border-r-0"}
            `}
						/>

						{isPlaying ? (
							// Pause icon - two bold bars
							<div className="flex gap-1.5 relative z-10">
								<div className="w-2 h-6 bg-current" />
								<div className="w-2 h-6 bg-current" />
							</div>
						) : (
							// Play icon - triangle
							<svg
								aria-hidden="true"
								className="w-7 h-7 ml-1 relative z-10"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<polygon points="5,3 19,12 5,21" />
							</svg>
						)}
					</button>

					{/* Right Section - Progress & Time */}
					<div className="flex-1 flex flex-col">
						{/* Progress Bar */}
						<div
							ref={progressRef}
							role="slider"
							tabIndex={0}
							aria-label="Audio progress"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round((currentTime / duration) * 100) || 0}
							onClick={handleProgressClick}
							onMouseDown={handleMouseDown}
							onKeyDown={(e) => {
								if (e.key === "ArrowRight") {
									e.preventDefault();
									if (audioRef.current)
										audioRef.current.currentTime = Math.min(
											duration,
											currentTime + 5,
										);
								}
								if (e.key === "ArrowLeft") {
									e.preventDefault();
									if (audioRef.current)
										audioRef.current.currentTime = Math.max(0, currentTime - 5);
								}
							}}
							className="flex-1 bg-muted cursor-pointer relative group min-h-[40px] flex items-center px-3 overflow-hidden"
						>
							{/* Waveform background - real audio data */}
							<div className="absolute inset-0 flex items-center gap-px px-1">
								{[...Array(WAVEFORM_BARS)].map((_, i) => (
									<div
										key={i}
										className={`flex-1 transition-all duration-300 ${isLoadingWaveform ? "bg-foreground/10 animate-pulse" : "bg-foreground/15"}`}
										style={{ height: `${getBarHeight(i) * 80}%` }}
									/>
								))}
							</div>

							{/* Progress fill with waveform */}
							<div
								className="absolute inset-y-0 left-0 overflow-hidden"
								style={{ width: `${progress}%` }}
							>
								<div
									className="absolute inset-0 flex items-center gap-px px-1"
									style={{ width: `${(100 / (progress || 1)) * 100}%` }}
								>
									{[...Array(WAVEFORM_BARS)].map((_, i) => (
										<div
											key={i}
											className="flex-1 bg-foreground/70"
											style={{ height: `${getBarHeight(i) * 80}%` }}
										/>
									))}
								</div>
							</div>

							{/* Playhead indicator */}
							<div
								className="absolute top-0 bottom-0 w-1 bg-foreground z-10 transition-all duration-75"
								style={{ left: `calc(${progress}% - 2px)` }}
							>
								{/* Playhead top marker */}
								<div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-2 bg-foreground" />
								<div className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-3 h-2 bg-foreground" />
							</div>
						</div>

						{/* Time Display - LCD Style */}
						<div className="h-6 border-t-2 border-foreground bg-background flex items-center justify-between px-3">
							<div className="flex items-center gap-2">
								{/* Playing indicator */}
								{isPlaying && (
									<div className="flex items-end gap-0.5 h-3">
										<div
											className="w-1 bg-foreground animate-pulse"
											style={{ height: "60%", animationDelay: "0ms" }}
										/>
										<div
											className="w-1 bg-foreground animate-pulse"
											style={{ height: "100%", animationDelay: "150ms" }}
										/>
										<div
											className="w-1 bg-foreground animate-pulse"
											style={{ height: "40%", animationDelay: "300ms" }}
										/>
									</div>
								)}
								<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									{isPlaying ? "PLAYING" : "PAUSED"}
								</span>
							</div>

							{/* Time readout */}
							<div className="font-mono text-xs font-bold tracking-tight">
								<span className="text-foreground">
									{formatTime(currentTime)}
								</span>
								<span className="text-muted-foreground mx-1">/</span>
								<span className="text-muted-foreground">
									{formatTime(duration)}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

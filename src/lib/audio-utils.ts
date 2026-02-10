// Audio processing utilities - all client-side using Web Audio API

export interface AudioInfo {
	duration: number;
	sampleRate: number;
	numberOfChannels: number;
}

// Load audio file into AudioBuffer
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
	const arrayBuffer = await file.arrayBuffer();
	const audioContext = new AudioContext();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
	await audioContext.close();
	return audioBuffer;
}

// Load audio from URL into AudioBuffer
export async function loadAudioFromUrl(url: string): Promise<AudioBuffer> {
	const response = await fetch(url);
	const arrayBuffer = await response.arrayBuffer();
	const audioContext = new AudioContext();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
	await audioContext.close();
	return audioBuffer;
}

// Get waveform data from URL (for AudioPlayer)
export async function getWaveformDataFromUrl(
	url: string,
	samples: number = 80,
): Promise<number[]> {
	const buffer = await loadAudioFromUrl(url);
	const channelData = buffer.getChannelData(0);
	const blockSize = Math.floor(channelData.length / samples);
	const waveform: number[] = [];

	for (let i = 0; i < samples; i++) {
		const start = i * blockSize;
		let sum = 0;
		for (let j = 0; j < blockSize; j++) {
			sum += Math.abs(channelData[start + j]);
		}
		waveform.push(sum / blockSize);
	}

	// Normalize to 0-1 range
	const max = Math.max(...waveform);
	if (max === 0) return waveform.map(() => 0); // Avoid division by zero
	return waveform.map((v) => v / max);
}

// Get audio file info
export async function getAudioInfo(file: File): Promise<AudioInfo> {
	const buffer = await loadAudioFile(file);
	return {
		duration: buffer.duration,
		sampleRate: buffer.sampleRate,
		numberOfChannels: buffer.numberOfChannels,
	};
}

// Convert AudioBuffer to WAV Blob
export function audioBufferToWav(buffer: AudioBuffer): Blob {
	const numOfChan = buffer.numberOfChannels;
	const length = buffer.length * numOfChan * 2;
	const bufferOut = new ArrayBuffer(44 + length);
	const view = new DataView(bufferOut);
	const channels: Float32Array[] = [];
	let offset = 0;
	let pos = 0;

	// Write WAV header
	const setUint16 = (data: number) => {
		view.setUint16(pos, data, true);
		pos += 2;
	};
	const setUint32 = (data: number) => {
		view.setUint32(pos, data, true);
		pos += 4;
	};

	// RIFF chunk descriptor
	setUint32(0x46464952); // "RIFF"
	setUint32(36 + length); // file length - 8
	setUint32(0x45564157); // "WAVE"

	// fmt sub-chunk
	setUint32(0x20746d66); // "fmt "
	setUint32(16); // subchunk1 size (16 for PCM)
	setUint16(1); // audio format (1 for PCM)
	setUint16(numOfChan);
	setUint32(buffer.sampleRate);
	setUint32(buffer.sampleRate * numOfChan * 2); // byte rate
	setUint16(numOfChan * 2); // block align
	setUint16(16); // bits per sample

	// data sub-chunk
	setUint32(0x61746164); // "data"
	setUint32(length);

	// Write audio data
	for (let i = 0; i < numOfChan; i++) {
		channels.push(buffer.getChannelData(i));
	}

	while (offset < buffer.length) {
		for (let i = 0; i < numOfChan; i++) {
			let sample = channels[i][offset];
			sample = Math.max(-1, Math.min(1, sample));
			sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(pos, sample, true);
			pos += 2;
		}
		offset++;
	}

	return new Blob([bufferOut], { type: "audio/wav" });
}

// Trim audio
export async function trimAudio(
	file: File,
	startTime: number,
	endTime: number,
): Promise<Blob> {
	const buffer = await loadAudioFile(file);
	const sampleRate = buffer.sampleRate;
	const startSample = Math.floor(startTime * sampleRate);
	const endSample = Math.floor(endTime * sampleRate);
	const newLength = endSample - startSample;

	const audioContext = new AudioContext();
	try {
		const newBuffer = audioContext.createBuffer(
			buffer.numberOfChannels,
			newLength,
			sampleRate,
		);

		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const oldData = buffer.getChannelData(channel);
			const newData = newBuffer.getChannelData(channel);
			for (let i = 0; i < newLength; i++) {
				newData[i] = oldData[startSample + i];
			}
		}

		return audioBufferToWav(newBuffer);
	} finally {
		await audioContext.close();
	}
}

// Adjust volume
export async function adjustVolume(
	file: File,
	volumeMultiplier: number,
): Promise<Blob> {
	const buffer = await loadAudioFile(file);
	const audioContext = new AudioContext();
	try {
		const newBuffer = audioContext.createBuffer(
			buffer.numberOfChannels,
			buffer.length,
			buffer.sampleRate,
		);

		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const oldData = buffer.getChannelData(channel);
			const newData = newBuffer.getChannelData(channel);
			for (let i = 0; i < buffer.length; i++) {
				newData[i] = Math.max(-1, Math.min(1, oldData[i] * volumeMultiplier));
			}
		}

		return audioBufferToWav(newBuffer);
	} finally {
		await audioContext.close();
	}
}

// Change speed (also changes pitch)
export async function changeSpeed(file: File, speed: number): Promise<Blob> {
	const buffer = await loadAudioFile(file);
	const newLength = Math.floor(buffer.length / speed);
	const audioContext = new AudioContext();
	try {
		const newBuffer = audioContext.createBuffer(
			buffer.numberOfChannels,
			newLength,
			buffer.sampleRate,
		);

		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const oldData = buffer.getChannelData(channel);
			const newData = newBuffer.getChannelData(channel);
			for (let i = 0; i < newLength; i++) {
				const oldIndex = i * speed;
				const index0 = Math.floor(oldIndex);
				const index1 = Math.min(index0 + 1, buffer.length - 1);
				const frac = oldIndex - index0;
				// Linear interpolation
				newData[i] = oldData[index0] * (1 - frac) + oldData[index1] * frac;
			}
		}

		return audioBufferToWav(newBuffer);
	} finally {
		await audioContext.close();
	}
}

// Apply fade in/out
export async function applyFade(
	file: File,
	fadeInDuration: number,
	fadeOutDuration: number,
): Promise<Blob> {
	const buffer = await loadAudioFile(file);
	const sampleRate = buffer.sampleRate;
	const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
	const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
	const fadeOutStart = buffer.length - fadeOutSamples;

	const audioContext = new AudioContext();
	try {
		const newBuffer = audioContext.createBuffer(
			buffer.numberOfChannels,
			buffer.length,
			buffer.sampleRate,
		);

		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const oldData = buffer.getChannelData(channel);
			const newData = newBuffer.getChannelData(channel);

			for (let i = 0; i < buffer.length; i++) {
				let multiplier = 1;

				// Fade in
				if (i < fadeInSamples) {
					multiplier = i / fadeInSamples;
				}
				// Fade out
				else if (i >= fadeOutStart) {
					multiplier = (buffer.length - i) / fadeOutSamples;
				}

				newData[i] = oldData[i] * multiplier;
			}
		}

		return audioBufferToWav(newBuffer);
	} finally {
		await audioContext.close();
	}
}

// Reverse audio
export async function reverseAudio(file: File): Promise<Blob> {
	const buffer = await loadAudioFile(file);
	const audioContext = new AudioContext();
	try {
		const newBuffer = audioContext.createBuffer(
			buffer.numberOfChannels,
			buffer.length,
			buffer.sampleRate,
		);

		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const oldData = buffer.getChannelData(channel);
			const newData = newBuffer.getChannelData(channel);
			for (let i = 0; i < buffer.length; i++) {
				newData[i] = oldData[buffer.length - 1 - i];
			}
		}

		return audioBufferToWav(newBuffer);
	} finally {
		await audioContext.close();
	}
}

// Generate waveform data for visualization
export async function getWaveformData(
	file: File,
	samples: number = 200,
): Promise<number[]> {
	const buffer = await loadAudioFile(file);
	const channelData = buffer.getChannelData(0); // Use first channel
	const blockSize = Math.floor(channelData.length / samples);
	const waveform: number[] = [];

	for (let i = 0; i < samples; i++) {
		const start = i * blockSize;
		let sum = 0;
		for (let j = 0; j < blockSize; j++) {
			sum += Math.abs(channelData[start + j]);
		}
		waveform.push(sum / blockSize);
	}

	// Normalize to 0-1 range
	const max = Math.max(...waveform);
	if (max === 0) return waveform.map(() => 0); // Avoid division by zero for silent audio
	return waveform.map((v) => v / max);
}

// Draw waveform to canvas and return as blob
export async function generateWaveformImage(
	file: File,
	width: number = 800,
	height: number = 200,
	color: string = "#C84C1C",
	backgroundColor: string = "#FAF7F2",
): Promise<Blob> {
	const waveform = await getWaveformData(file, width);

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext("2d")!;

	// Background
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, width, height);

	// Draw waveform
	ctx.fillStyle = color;
	const centerY = height / 2;
	const maxHeight = height * 0.8;

	for (let i = 0; i < waveform.length; i++) {
		const barHeight = waveform[i] * maxHeight;
		ctx.fillRect(i, centerY - barHeight / 2, 1, barHeight);
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			// Clean up canvas to free memory
			canvas.width = 0;
			canvas.height = 0;
			if (blob) resolve(blob);
			else reject(new Error("Failed to create waveform image"));
		}, "image/png");
	});
}

// Format duration as MM:SS or HH:MM:SS
export function formatDuration(seconds: number): string {
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hrs > 0) {
		return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Parse time string (MM:SS or HH:MM:SS) to seconds
export function parseTimeString(time: string): number {
	const parts = time.split(":").map(Number);
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	}
	return parts[0] * 60 + parts[1];
}

// Download audio blob
export function downloadAudio(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// Re-export formatFileSize from shared utils
export { formatFileSize } from "./utils";

// Convert AudioBuffer to MP3 using lamejs
export async function audioBufferToMp3(
	buffer: AudioBuffer,
	bitrate: number = 128,
): Promise<Blob> {
	// Lazy load lamejs only when converting to MP3
	const lamejs = (await import("@breezystack/lamejs")).default;

	const channels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const mp3encoder = new lamejs.Mp3Encoder(
		channels === 1 ? 1 : 2,
		sampleRate,
		bitrate,
	);

	const mp3Data: Uint8Array[] = [];
	const sampleBlockSize = 1152;

	// Get channel data
	const left = buffer.getChannelData(0);
	const right = channels > 1 ? buffer.getChannelData(1) : null;

	// Convert to Int16
	const leftInt16 = new Int16Array(left.length);
	const rightInt16 = right ? new Int16Array(right.length) : null;

	for (let i = 0; i < left.length; i++) {
		leftInt16[i] = left[i] < 0 ? left[i] * 0x8000 : left[i] * 0x7fff;
		if (rightInt16 && right) {
			rightInt16[i] = right[i] < 0 ? right[i] * 0x8000 : right[i] * 0x7fff;
		}
	}

	// Encode in chunks
	for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
		const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
		const rightChunk = rightInt16
			? rightInt16.subarray(i, i + sampleBlockSize)
			: leftChunk;

		const mp3buf =
			channels === 1
				? mp3encoder.encodeBuffer(leftChunk)
				: mp3encoder.encodeBuffer(leftChunk, rightChunk);

		if (mp3buf.length > 0) {
			mp3Data.push(new Uint8Array(mp3buf));
		}
	}

	// Flush remaining
	const mp3buf = mp3encoder.flush();
	if (mp3buf.length > 0) {
		mp3Data.push(new Uint8Array(mp3buf));
	}

	// Calculate total length and merge
	const totalLength = mp3Data.reduce((acc, arr) => acc + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of mp3Data) {
		result.set(arr, offset);
		offset += arr.length;
	}

	return new Blob([result], { type: "audio/mp3" });
}

// Convert audio file to specified format
export type AudioFormat = "wav" | "mp3";

export async function convertAudioFormat(
	file: File,
	outputFormat: AudioFormat,
	options?: { bitrate?: number },
): Promise<Blob> {
	const buffer = await loadAudioFile(file);

	switch (outputFormat) {
		case "wav":
			return audioBufferToWav(buffer);
		case "mp3":
			return audioBufferToMp3(buffer, options?.bitrate || 128);
		default:
			throw new Error(`Unsupported format: ${outputFormat}`);
	}
}

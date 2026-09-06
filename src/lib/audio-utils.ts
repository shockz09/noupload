// Audio processing utilities - all client-side using Web Audio API

import { timeStretchPlanes } from "./audio/time-stretch";
import { createYielder } from "./yield";

export interface AudioInfo {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

// Load audio file into AudioBuffer
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    // decodeAudioData rejects with a bare DOMException that says nothing about
    // which file failed — unhelpful on a page where several are queued.
    throw new Error(`Could not read audio from "${file.name}". The file may be corrupt or in an unsupported format.`, {
      cause: err,
    });
  } finally {
    await audioContext.close();
  }
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
export async function getWaveformDataFromUrl(url: string, samples: number = 80): Promise<number[]> {
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

/** Frames interleaved between checks of the yield clock — well under a millisecond. */
const WAV_CHUNK_FRAMES = 16384;

/**
 * Convert an AudioBuffer to a WAV Blob.
 *
 * Async because a long file is a lot of samples to write one at a time: half an hour
 * of stereo is 160 million of them, and doing that in one go froze the page for
 * three and a half seconds with nothing painted. Yielding between chunks keeps the
 * page alive; a short file never reaches the interval and never pays for it.
 */
export async function audioBufferToWav(buffer: AudioBuffer, onProgress?: (progress: number) => void): Promise<Blob> {
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

  const yieldIfDue = createYielder();
  while (offset < buffer.length) {
    const chunkEnd = Math.min(offset + WAV_CHUNK_FRAMES, buffer.length);
    while (offset < chunkEnd) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = channels[i][offset];
        sample = Math.max(-1, Math.min(1, sample));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    if (await yieldIfDue()) onProgress?.(offset / buffer.length);
  }
  onProgress?.(1);

  return new Blob([bufferOut], { type: "audio/wav" });
}

// Trim audio
export async function trimAudio(file: File, startTime: number, endTime: number): Promise<Blob> {
  if (!Number.isFinite(startTime) || startTime < 0) {
    throw new Error("Trim start must be 0 or greater.");
  }
  if (!Number.isFinite(endTime) || endTime <= startTime) {
    throw new Error("Trim end must be after start.");
  }

  const buffer = await loadAudioFile(file);
  const sampleRate = buffer.sampleRate;
  // Clamp to the buffer. Reading past the end used to hand back `undefined`,
  // which lands in the Float32Array as NaN and then gets written out as
  // silence — so trimming 0–10s of a 1s file produced a 10s file.
  const startSample = Math.min(Math.floor(startTime * sampleRate), buffer.length);
  const endSample = Math.min(Math.floor(endTime * sampleRate), buffer.length);
  const newLength = endSample - startSample;

  if (newLength <= 0) {
    throw new Error("Trim range falls outside the audio.");
  }

  const audioContext = new AudioContext();
  try {
    const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, newLength, sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const oldData = buffer.getChannelData(channel);
      newBuffer.getChannelData(channel).set(oldData.subarray(startSample, endSample));
    }

    return await audioBufferToWav(newBuffer);
  } finally {
    await audioContext.close();
  }
}

// Adjust volume
export async function adjustVolume(file: File, volumeMultiplier: number): Promise<Blob> {
  const buffer = await loadAudioFile(file);
  const audioContext = new AudioContext();
  try {
    const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const oldData = buffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        newData[i] = Math.max(-1, Math.min(1, oldData[i] * volumeMultiplier));
      }
    }

    return await audioBufferToWav(newBuffer);
  } finally {
    await audioContext.close();
  }
}

/**
 * Change how fast audio plays.
 *
 * By default the pitch is preserved: the timeline is stretched with WSOLA, so a
 * sped-up voice stays the same voice instead of turning into a chipmunk. Pass
 * `preservePitch: false` for the old tape-speed behaviour, where resampling drags
 * every frequency along with the speed.
 */
export async function changeSpeed(
  file: File,
  speed: number,
  options?: { preservePitch?: boolean; onProgress?: (progress: number) => void },
): Promise<Blob> {
  // Without this, speed 0 makes newLength Infinity and createBuffer throws a
  // bare "Invalid buffer length" RangeError with no hint at the cause.
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("Playback speed must be greater than 0.");
  }

  const onProgress = options?.onProgress;
  onProgress?.(0);
  const buffer = await loadAudioFile(file);
  const audioContext = new AudioContext();
  try {
    if (options?.preservePitch === false) {
      const resampled = resampleBuffer(audioContext, buffer, speed);
      return await audioBufferToWav(resampled, (p) => onProgress?.(p));
    }

    // Shares of the bar. Measured on a 10-minute file: decode and encode are each
    // about half the length of the stretch, so the bar keeps moving to the end
    // instead of sitting at 100% through a second of encoding.
    const DECODED = 0.2;
    const STRETCHED = 0.75;
    onProgress?.(DECODED);
    const planes = await timeStretchPlanes(
      Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel).slice()),
      speed,
      (p) => onProgress?.(DECODED + p * (STRETCHED - DECODED)),
    );
    const stretched = audioContext.createBuffer(buffer.numberOfChannels, planes[0].length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      stretched.getChannelData(channel).set(planes[channel]);
    }
    return await audioBufferToWav(stretched, (p) => onProgress?.(STRETCHED + p * (1 - STRETCHED)));
  } finally {
    await audioContext.close();
  }
}

/** Tape-speed resampling: shorter (or longer) and pitch-shifted with it. */
function resampleBuffer(audioContext: AudioContext, buffer: AudioBuffer, speed: number): AudioBuffer {
  const newLength = Math.floor(buffer.length / speed);
  const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

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
  return newBuffer;
}

// Apply fade in/out
export async function applyFade(file: File, fadeInDuration: number, fadeOutDuration: number): Promise<Blob> {
  const buffer = await loadAudioFile(file);
  const sampleRate = buffer.sampleRate;
  const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
  const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
  const fadeOutStart = buffer.length - fadeOutSamples;

  const audioContext = new AudioContext();
  try {
    const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

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

    return await audioBufferToWav(newBuffer);
  } finally {
    await audioContext.close();
  }
}

// Reverse audio
export async function reverseAudio(file: File): Promise<Blob> {
  const buffer = await loadAudioFile(file);
  const audioContext = new AudioContext();
  try {
    const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const oldData = buffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        newData[i] = oldData[buffer.length - 1 - i];
      }
    }

    return await audioBufferToWav(newBuffer);
  } finally {
    await audioContext.close();
  }
}

// Generate waveform data for visualization
export async function getWaveformData(file: File, samples: number = 200): Promise<number[]> {
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

// Map CBR bitrate to LAME VBR quality (0 = best, 9.999 = worst)
function bitrateToVbrQuality(bitrate: number): number {
  if (bitrate >= 320) return 0;
  if (bitrate >= 256) return 1;
  if (bitrate >= 192) return 2;
  if (bitrate >= 160) return 3;
  if (bitrate >= 128) return 4;
  if (bitrate >= 96) return 6;
  if (bitrate >= 64) return 8;
  return 9;
}

// Convert AudioBuffer to MP3 using WASM-compiled LAME
export async function audioBufferToMp3(buffer: AudioBuffer, bitrate: number = 128): Promise<Blob> {
  const { createMp3Encoder } = await import("wasm-media-encoders");
  const encoder = await createMp3Encoder();

  const channels = buffer.numberOfChannels;
  encoder.configure({
    sampleRate: buffer.sampleRate,
    channels: channels === 1 ? 1 : 2,
    vbrQuality: bitrateToVbrQuality(bitrate),
  });

  const mp3Data: Uint8Array[] = [];
  const blockSize = 1152;

  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;

  // Encode in chunks — encoder accepts Float32Array directly
  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right.subarray(i, i + blockSize);
    const mp3buf = encoder.encode([leftChunk, rightChunk]);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  // Finalize — returns last frames
  const final = encoder.finalize();
  if (final.length > 0) {
    mp3Data.push(new Uint8Array(final));
  }

  // Merge chunks
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
      return await audioBufferToWav(buffer);
    case "mp3":
      return audioBufferToMp3(buffer, options?.bitrate || 128);
    default:
      throw new Error(`Unsupported format: ${outputFormat}`);
  }
}

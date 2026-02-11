// FFmpeg WASM utilities - fully lazy loaded to avoid initial page load impact
// All imports are dynamic to keep FFmpeg out of the initial bundle

// Type-only import doesn't add to bundle (stripped at compile time)
import type { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

// Lazy load fetchFile utility
const getFetchFile = async () => {
  const { fetchFile } = await import("@ffmpeg/util");
  return fetchFile;
};

// Version for cache busting - update when upgrading FFmpeg
const FFMPEG_VERSION = "0.12.10";
const CACHE_NAME = `ffmpeg-core-${FFMPEG_VERSION}`;

export type FFmpegLoadState = "idle" | "loading" | "ready" | "error";

// Cached fetch with Cache API - persists across browser sessions
async function cachedToBlobURL(url: string, mimeType: string): Promise<string> {
  // Check if Cache API is available (not in SSR or older browsers)
  if (typeof caches === "undefined") {
    // Fallback to regular fetch
    const { toBlobURL } = await import("@ffmpeg/util");
    return toBlobURL(url, mimeType);
  }

  const cache = await caches.open(CACHE_NAME);

  let response = await cache.match(url);
  if (!response) {
    // Not cached - fetch from CDN and store
    response = await fetch(url);
    await cache.put(url, response.clone());
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Lazy load FFmpeg singleton
export async function getFFmpeg(_onLoadProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg;

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      ffmpeg = new FFmpeg();

      const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_VERSION}/dist/umd`;

      await ffmpeg.load({
        coreURL: await cachedToBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await cachedToBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      return ffmpeg;
    } catch (error) {
      // Reset so subsequent calls can retry instead of returning the rejected promise
      ffmpeg = null;
      loadPromise = null;
      throw error;
    }
  })();

  return loadPromise;
}

// Check if FFmpeg is already loaded
export function isFFmpegLoaded(): boolean {
  return ffmpeg?.loaded ?? false;
}

// Helper to get MIME type from extension
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
    webm: "audio/webm",
  };
  return mimeTypes[ext || ""] || "audio/mpeg";
}

// Get file extension
function getExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? `.${ext}` : "";
}

export type ExtractOutputFormat = "mp3" | "wav" | "ogg" | "flac";

// Extract audio from video file
export async function extractAudioFromVideo(
  file: File,
  outputFormat: ExtractOutputFormat = "mp3",
  bitrate: number = 192,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpegInstance = await getFFmpeg();

  // Set up progress handler with cleanup
  const progressHandler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;

  if (progressHandler) {
    ffmpegInstance.on("progress", progressHandler);
  }

  try {
    const inputName = `input${getExtension(file.name)}`;
    const outputName = `output.${outputFormat}`;

    await ffmpegInstance.writeFile(inputName, await (await getFetchFile())(file));

    // Build ffmpeg args based on format
    const args = ["-i", inputName, "-vn"]; // -vn = no video

    switch (outputFormat) {
      case "mp3":
        args.push("-acodec", "libmp3lame", "-b:a", `${bitrate}k`);
        break;
      case "wav":
        args.push("-acodec", "pcm_s16le");
        break;
      case "ogg":
        args.push("-acodec", "libvorbis", "-b:a", `${bitrate}k`);
        break;
      case "flac":
        args.push("-acodec", "flac");
        break;
    }

    args.push(outputName);

    await ffmpegInstance.exec(args);

    const data = await ffmpegInstance.readFile(outputName);

    // Cleanup files
    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    // Convert to proper Uint8Array for Blob compatibility
    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8], { type: getMimeType(outputName) });
  } finally {
    // Always cleanup event handler
    if (progressHandler) {
      ffmpegInstance.off("progress", progressHandler);
    }
  }
}

export type DenoiseStrength = "light" | "medium" | "strong";

// Denoise audio file
export async function denoiseAudio(
  file: File,
  strength: DenoiseStrength = "medium",
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpegInstance = await getFFmpeg();

  const progressHandler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;

  if (progressHandler) {
    ffmpegInstance.on("progress", progressHandler);
  }

  try {
    const inputName = `input${getExtension(file.name)}`;
    const outputName = "output.wav"; // Output as WAV for quality

    await ffmpegInstance.writeFile(inputName, await (await getFetchFile())(file));

    // Build filter based on strength
    let filter: string;
    switch (strength) {
      case "light":
        filter = "highpass=f=80,afftdn=nf=-20";
        break;
      case "medium":
        filter = "highpass=f=80,lowpass=f=12000,afftdn=nf=-25";
        break;
      case "strong":
        filter = "highpass=f=100,lowpass=f=10000,afftdn=nf=-30";
        break;
    }

    await ffmpegInstance.exec(["-i", inputName, "-af", filter, outputName]);

    const data = await ffmpegInstance.readFile(outputName);

    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8], { type: "audio/wav" });
  } finally {
    if (progressHandler) {
      ffmpegInstance.off("progress", progressHandler);
    }
  }
}

export type ConvertOutputFormat = "mp3" | "wav" | "ogg" | "flac" | "aac" | "webm";

// Convert audio format using FFmpeg (for formats not supported by Web Audio API)
export async function convertAudioFFmpeg(
  file: File,
  outputFormat: ConvertOutputFormat,
  bitrate: number = 192,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpegInstance = await getFFmpeg();

  const progressHandler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;

  if (progressHandler) {
    ffmpegInstance.on("progress", progressHandler);
  }

  try {
    const inputName = `input${getExtension(file.name)}`;
    const outputName = `output.${outputFormat}`;

    await ffmpegInstance.writeFile(inputName, await (await getFetchFile())(file));

    const args = ["-i", inputName];

    switch (outputFormat) {
      case "mp3":
        args.push("-acodec", "libmp3lame", "-b:a", `${bitrate}k`);
        break;
      case "wav":
        args.push("-acodec", "pcm_s16le");
        break;
      case "ogg":
        args.push("-acodec", "libvorbis", "-b:a", `${bitrate}k`);
        break;
      case "flac":
        args.push("-acodec", "flac");
        break;
      case "aac":
        args.push("-acodec", "aac", "-b:a", `${bitrate}k`);
        break;
      case "webm":
        args.push("-acodec", "libopus", "-b:a", `${bitrate}k`);
        break;
    }

    args.push(outputName);

    await ffmpegInstance.exec(args);

    const data = await ffmpegInstance.readFile(outputName);

    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8], { type: getMimeType(outputName) });
  } finally {
    if (progressHandler) {
      ffmpegInstance.off("progress", progressHandler);
    }
  }
}

// Get video duration using FFmpeg (for videos that can't be decoded by browser)
export async function getVideoDuration(file: File): Promise<number> {
  const ffmpegInstance = await getFFmpeg();

  const inputName = `input${getExtension(file.name)}`;
  await ffmpegInstance.writeFile(inputName, await (await getFetchFile())(file));

  let duration = 0;

  // Listen for log messages to extract duration
  const logHandler = ({ message }: { message: string }) => {
    // Duration format: "Duration: 00:00:10.00"
    const match = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }
  };

  ffmpegInstance.on("log", logHandler);

  try {
    // Run ffmpeg with no output to just get info
    try {
      await ffmpegInstance.exec(["-i", inputName, "-f", "null", "-"]);
    } catch {
      // ffmpeg returns error when no output specified, but we got the duration
    }

    await ffmpegInstance.deleteFile(inputName);

    return duration;
  } finally {
    ffmpegInstance.off("log", logHandler);
  }
}

// ============================================
// Phase 2: Enhancement Features
// ============================================

export type NormalizePreset = "spotify" | "podcast" | "broadcast" | "youtube";

// Normalize audio loudness using EBU R128 standard
export async function normalizeAudio(
  file: File,
  preset: NormalizePreset = "podcast",
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpegInstance = await getFFmpeg();

  const progressHandler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;

  if (progressHandler) {
    ffmpegInstance.on("progress", progressHandler);
  }

  try {
    const inputName = `input${getExtension(file.name)}`;
    const outputName = "output.wav";

    await ffmpegInstance.writeFile(inputName, await (await getFetchFile())(file));

    // EBU R128 loudness targets (LUFS)
    const targets: Record<NormalizePreset, string> = {
      spotify: "-14",
      youtube: "-14",
      podcast: "-16",
      broadcast: "-23",
    };

    const target = targets[preset];
    const filter = `loudnorm=I=${target}:TP=-1.5:LRA=11`;

    await ffmpegInstance.exec(["-i", inputName, "-af", filter, outputName]);

    const data = await ffmpegInstance.readFile(outputName);

    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8], { type: "audio/wav" });
  } finally {
    if (progressHandler) {
      ffmpegInstance.off("progress", progressHandler);
    }
  }
}

export type SilenceMode = "trim-ends" | "remove-all";

// Remove silence from audio
export async function removeSilence(
  file: File,
  mode: SilenceMode = "trim-ends",
  threshold: number = -50,
  minDuration: number = 0.5,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpegInstance = await getFFmpeg();

  const progressHandler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;

  if (progressHandler) {
    ffmpegInstance.on("progress", progressHandler);
  }

  try {
    const inputName = `input${getExtension(file.name)}`;
    const outputName = "output.wav";

    await ffmpegInstance.writeFile(inputName, await (await getFetchFile())(file));

    let filter: string;
    if (mode === "trim-ends") {
      // Remove silence at start and end only (reverse trick for end)
      filter = `silenceremove=start_periods=1:start_silence=${minDuration}:start_threshold=${threshold}dB,areverse,silenceremove=start_periods=1:start_silence=${minDuration}:start_threshold=${threshold}dB,areverse`;
    } else {
      // Remove all silence throughout
      filter = `silenceremove=stop_periods=-1:stop_duration=${minDuration}:stop_threshold=${threshold}dB`;
    }

    await ffmpegInstance.exec(["-i", inputName, "-af", filter, outputName]);

    const data = await ffmpegInstance.readFile(outputName);

    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8], { type: "audio/wav" });
  } finally {
    if (progressHandler) {
      ffmpegInstance.off("progress", progressHandler);
    }
  }
}

export type MergeOutputFormat = "mp3" | "wav";

// Merge multiple audio files into one
export async function mergeAudio(
  files: File[],
  outputFormat: MergeOutputFormat = "mp3",
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const ffmpegInstance = await getFFmpeg();

  const progressHandler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;

  if (progressHandler) {
    ffmpegInstance.on("progress", progressHandler);
  }

  try {
    // Write all input files to FFmpeg filesystem
    const inputNames: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const inputName = `input${i}.wav`; // Normalize to wav for consistent concat
      inputNames.push(inputName);

      // First convert each file to wav for consistent format
      const tempInput = `temp${i}${getExtension(files[i].name)}`;
      await ffmpegInstance.writeFile(tempInput, await (await getFetchFile())(files[i]));
      await ffmpegInstance.exec(["-i", tempInput, "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2", inputName]);
      await ffmpegInstance.deleteFile(tempInput);
    }

    // Create concat file list
    const concatList = inputNames.map((name) => `file '${name}'`).join("\n");
    await ffmpegInstance.writeFile("concat.txt", concatList);

    const outputName = `output.${outputFormat}`;

    // Concatenate
    const args = ["-f", "concat", "-safe", "0", "-i", "concat.txt"];

    if (outputFormat === "mp3") {
      args.push("-acodec", "libmp3lame", "-b:a", "192k");
    } else {
      args.push("-acodec", "pcm_s16le");
    }

    args.push(outputName);

    await ffmpegInstance.exec(args);

    const data = await ffmpegInstance.readFile(outputName);

    // Cleanup all files
    for (const name of inputNames) {
      await ffmpegInstance.deleteFile(name);
    }
    await ffmpegInstance.deleteFile("concat.txt");
    await ffmpegInstance.deleteFile(outputName);

    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8], { type: getMimeType(outputName) });
  } finally {
    if (progressHandler) {
      ffmpegInstance.off("progress", progressHandler);
    }
  }
}

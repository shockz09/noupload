// Shared constants used across the app

// File extension constants for dropzones
export const VIDEO_EXTENSIONS = ".mp4,.mov,.mkv,.avi,.webm,.flv,.wmv,.m4v,.3gp";
export const AUDIO_EXTENSIONS = ".mp3,.wav,.ogg,.m4a,.aac,.flac";
export const AUDIO_VIDEO_EXTENSIONS = `${AUDIO_EXTENSIONS},${VIDEO_EXTENSIONS}`;

// Pre-computed arrays for faster lookups
const VIDEO_EXT_SET = new Set(VIDEO_EXTENSIONS.split(","));
const AUDIO_EXT_SET = new Set(AUDIO_EXTENSIONS.split(","));

export function isVideoFile(filename: string): boolean {
  const ext = `.${filename.split(".").pop()?.toLowerCase()}`;
  return VIDEO_EXT_SET.has(ext);
}

export function isAudioFile(filename: string): boolean {
  const ext = `.${filename.split(".").pop()?.toLowerCase()}`;
  return AUDIO_EXT_SET.has(ext);
}

// Audio bitrate options
export const AUDIO_BITRATES = [
  { value: 128, label: "128", desc: "Standard" },
  { value: 192, label: "192", desc: "High" },
  { value: 256, label: "256", desc: "Very High" },
  { value: 320, label: "320", desc: "Maximum" },
] as const;

// Audio format options
export const AUDIO_FORMATS = [
  { value: "mp3" as const, label: "MP3", desc: "Universal" },
  { value: "wav" as const, label: "WAV", desc: "Lossless" },
  { value: "ogg" as const, label: "OGG", desc: "Open format" },
  { value: "aac" as const, label: "AAC", desc: "Apple/Web" },
];

// Audio normalize presets
export const NORMALIZE_PRESETS = [
  {
    value: "spotify" as const,
    label: "Spotify",
    desc: "Streaming",
    lufs: "-14 LUFS",
  },
  {
    value: "podcast" as const,
    label: "Podcast",
    desc: "Voice",
    lufs: "-16 LUFS",
  },
  {
    value: "broadcast" as const,
    label: "Broadcast",
    desc: "TV/Radio",
    lufs: "-23 LUFS",
  },
] as const;

// Image resize presets
export const IMAGE_RESIZE_PRESETS = [
  { label: "HD (1280×720)", width: 1280, height: 720 },
  { label: "Full HD (1920×1080)", width: 1920, height: 1080 },
  { label: "Instagram (1080×1080)", width: 1080, height: 1080 },
  { label: "Thumbnail (300×300)", width: 300, height: 300 },
];

// Image format options (bulk operations)
export const IMAGE_FORMATS_BULK = [
  { value: "jpeg" as const, label: "JPEG", ext: "jpg" },
  { value: "png" as const, label: "PNG", ext: "png" },
  { value: "webp" as const, label: "WebP", ext: "webp" },
];

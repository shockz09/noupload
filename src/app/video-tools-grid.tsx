import {
  VideoCompressIcon,
  VideoConvertIcon,
  VideoTrimIcon,
  VideoMetadataIcon,
  VideoToGifIcon,
  RemoveAudioIcon,
} from "@/components/icons/video";
import { ExtractIcon } from "@/components/icons/audio";

export const videoTools = [
  {
    title: "Compress",
    description: "Reduce video file size with quality control",
    href: "/video/compress",
    icon: VideoCompressIcon,
    category: "optimize",
    colorClass: "tool-video-compress",
    keywords: ["shrink", "smaller", "reduce size", "bitrate"],
  },
  {
    title: "Trim",
    description: "Visually select and cut video clips",
    href: "/video/trim",
    icon: VideoTrimIcon,
    category: "edit",
    colorClass: "tool-video-trim",
    keywords: ["cut", "clip", "shorten", "start end"],
  },
  {
    title: "Convert",
    description: "Convert between video formats",
    href: "/video/convert",
    icon: VideoConvertIcon,
    category: "convert",
    colorClass: "tool-video-convert",
    keywords: [
      "mp4 to webm", "webm to mp4", "mov to mp4", "avi to mp4",
      "mkv to mp4", "video format", "change format",
    ],
  },
  {
    title: "Remove Audio",
    description: "Strip audio track from video",
    href: "/video/remove-audio",
    icon: RemoveAudioIcon,
    category: "edit",
    colorClass: "tool-video-remove-audio",
    keywords: ["mute", "silent", "no sound", "strip sound"],
  },
  {
    title: "To GIF",
    description: "Convert video clips to animated GIFs",
    href: "/video/to-gif",
    icon: VideoToGifIcon,
    category: "convert",
    colorClass: "tool-video-to-gif",
    keywords: ["video to gif", "animated", "mp4 to gif", "loop"],
  },
  {
    title: "Extract Audio",
    description: "Extract audio track from video",
    href: "/video/extract-audio",
    icon: ExtractIcon,
    category: "convert",
    colorClass: "tool-audio-extract",
    keywords: ["get audio", "rip audio", "video to mp3", "video to audio"],
  },
  {
    title: "Metadata",
    description: "View video file information",
    href: "/video/metadata",
    icon: VideoMetadataIcon,
    category: "info",
    colorClass: "tool-video-metadata",
    keywords: ["info", "details", "codec", "resolution", "duration", "fps"],
  },
];

export const videoCategoryLabels: Record<string, string> = {
  optimize: "Optimize",
  edit: "Edit",
  convert: "Convert",
  info: "Info",
};

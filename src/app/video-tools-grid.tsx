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
  },
  {
    title: "Trim",
    description: "Visually select and cut video clips",
    href: "/video/trim",
    icon: VideoTrimIcon,
    category: "edit",
    colorClass: "tool-video-trim",
  },
  {
    title: "Convert",
    description: "Convert between video formats",
    href: "/video/convert",
    icon: VideoConvertIcon,
    category: "convert",
    colorClass: "tool-video-convert",
  },
  {
    title: "Remove Audio",
    description: "Strip audio track from video",
    href: "/video/remove-audio",
    icon: RemoveAudioIcon,
    category: "edit",
    colorClass: "tool-video-remove-audio",
  },
  {
    title: "To GIF",
    description: "Convert video clips to animated GIFs",
    href: "/video/to-gif",
    icon: VideoToGifIcon,
    category: "convert",
    colorClass: "tool-video-to-gif",
  },
  {
    title: "Extract Audio",
    description: "Extract audio track from video",
    href: "/video/extract-audio",
    icon: ExtractIcon,
    category: "convert",
    colorClass: "tool-audio-extract",
  },
  {
    title: "Metadata",
    description: "View video file information",
    href: "/video/metadata",
    icon: VideoMetadataIcon,
    category: "info",
    colorClass: "tool-video-metadata",
  },
];

export const videoCategoryLabels: Record<string, string> = {
  optimize: "Optimize",
  edit: "Edit",
  convert: "Convert",
  info: "Info",
};

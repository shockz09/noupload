"use client";

import Link from "next/link";
import {
  AudioMergeIcon,
  DenoiseIcon,
  ExtractIcon,
  FadeIcon,
  MicIcon,
  MusicTagIcon,
  NormalizeIcon,
  ReverseIcon,
  SilenceIcon,
  SpeedIcon,
  TrimIcon,
  VolumeIcon,
  WaveformIcon,
} from "@/components/icons/audio";
import { ConvertIcon } from "@/components/icons/image";
import { ArrowLeftIcon } from "@/components/icons/ui";
import { ToolSearch } from "@/components/shared/ToolSearch";

const tools = [
  {
    title: "Convert",
    description: "Convert between audio formats",
    href: "/audio/convert",
    icon: ConvertIcon,
    category: "convert",
    colorClass: "tool-audio-convert",
  },
  {
    title: "Extract Audio",
    description: "Extract audio track from any video file",
    href: "/audio/extract",
    icon: ExtractIcon,
    category: "convert",
    colorClass: "tool-audio-extract",
  },
  {
    title: "Trim Audio",
    description: "Cut audio to specific start and end time",
    href: "/audio/trim",
    icon: TrimIcon,
    category: "edit",
    colorClass: "tool-audio-trim",
  },
  {
    title: "Volume",
    description: "Increase or decrease audio volume",
    href: "/audio/volume",
    icon: VolumeIcon,
    category: "edit",
    colorClass: "tool-audio-volume",
  },
  {
    title: "Speed",
    description: "Speed up or slow down audio playback",
    href: "/audio/speed",
    icon: SpeedIcon,
    category: "edit",
    colorClass: "tool-audio-speed",
  },
  {
    title: "Record",
    description: "Record audio from your microphone",
    href: "/audio/record",
    icon: MicIcon,
    category: "create",
    colorClass: "tool-audio-record",
  },
  {
    title: "Waveform",
    description: "Generate waveform image from audio",
    href: "/audio/waveform",
    icon: WaveformIcon,
    category: "convert",
    colorClass: "tool-audio-waveform",
  },
  {
    title: "Fade",
    description: "Add fade in and fade out effects",
    href: "/audio/fade",
    icon: FadeIcon,
    category: "effects",
    colorClass: "tool-audio-fade",
  },
  {
    title: "Denoise",
    description: "Remove background noise from recordings",
    href: "/audio/denoise",
    icon: DenoiseIcon,
    category: "effects",
    colorClass: "tool-audio-denoise",
  },
  {
    title: "Normalize",
    description: "Make audio volume consistent",
    href: "/audio/normalize",
    icon: NormalizeIcon,
    category: "edit",
    colorClass: "tool-audio-normalize",
  },
  {
    title: "Remove Silence",
    description: "Trim silent parts from audio",
    href: "/audio/remove-silence",
    icon: SilenceIcon,
    category: "edit",
    colorClass: "tool-audio-silence",
  },
  {
    title: "Merge",
    description: "Combine multiple audio files",
    href: "/audio/merge",
    icon: AudioMergeIcon,
    category: "edit",
    colorClass: "tool-audio-merge",
  },
  {
    title: "Reverse",
    description: "Play audio backwards",
    href: "/audio/reverse",
    icon: ReverseIcon,
    category: "effects",
    colorClass: "tool-audio-reverse",
  },
  {
    title: "Edit Metadata",
    description: "Edit ID3 tags for MP3 files",
    href: "/audio/metadata",
    icon: MusicTagIcon,
    category: "edit",
    colorClass: "tool-audio-metadata",
  },
];

const categoryLabels: Record<string, string> = {
  edit: "Edit",
  create: "Create",
  effects: "Effects",
  convert: "Convert",
};

export default function AudioPage() {
  return (
    <div className="page-enter space-y-16">
      {/* Back Link + Hero Section */}
      <section className="space-y-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Tools
        </Link>

        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
            Audio tools that <span className="italic">stay</span>{" "}
            <span className="relative inline-block">
              private
              <svg
                aria-hidden="true"
                className="absolute -bottom-2 left-0 w-full h-3 text-primary"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,8 Q50,0 100,8 T200,8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
        </div>

        <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
          Trim, record, adjust, and transform audio files entirely in your browser. No uploads, no waiting.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-semibold">
          <span>No uploads</span>
          <span className="text-muted-foreground">·</span>
          <span>No servers</span>
          <span className="text-muted-foreground">·</span>
          <span>Free forever</span>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display">Audio Tools</h2>
          <div className="flex-1 h-0.5 bg-foreground" />
        </div>

        <ToolSearch tools={tools} categoryLabels={categoryLabels} placeholder="Search audio tools..." />
      </section>

    </div>
  );
}

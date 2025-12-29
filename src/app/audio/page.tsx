import Link from "next/link";
import {
  ArrowLeftIcon,
  TrimIcon,
  MicIcon,
  VolumeIcon,
  SpeedIcon,
  FadeIcon,
  ReverseIcon,
  WaveformIcon,
  ConvertIcon,
  ExtractIcon,
  DenoiseIcon,
  NormalizeIcon,
  SilenceIcon,
  AudioMergeIcon,
} from "@/components/icons";

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
          Back to PDF Tools
        </Link>

        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
            Audio tools that{" "}
            <span className="italic">stay</span>{" "}
            <span className="relative inline-block">
              private
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link key={tool.href} href={tool.href}>
                <article className={`tool-card ${tool.colorClass} group h-full cursor-pointer`}>
                  <span className="category-tag">{categoryLabels[tool.category]}</span>

                  <div className="space-y-4">
                    <div className="tool-icon">
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="space-y-2 pr-16">
                      <h3 className="text-xl font-bold text-foreground">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                      <span>Use tool</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 border-t-2 border-foreground">
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="feature-item">
            <div className="feature-icon">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">100% Private</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Audio never leaves your device. Process sensitive recordings with confidence.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">Instant Processing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No upload queues. Your browser does all the work instantly.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">WAV Export</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All audio exports as high-quality WAV for maximum compatibility.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

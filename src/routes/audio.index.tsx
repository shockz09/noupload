import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/audio/")({
	head: () => ({
		meta: [
			{ title: "Free Online Audio Tools - Trim, Convert, Merge Audio | noupload" },
			{ name: "description", content: "Free audio editing tools that work in your browser. Trim, merge, convert, adjust speed, remove noise, and more. No uploads, complete privacy." },
			{ name: "keywords", content: "audio editor, audio trimmer, audio converter, merge audio, audio tools online, free audio editor" },
			{ property: "og:title", content: "Free Online Audio Tools - Trim, Convert, Merge Audio" },
			{ property: "og:description", content: "Free audio editing tools that work in your browser. No uploads, complete privacy." },
		],
	}),
	component: AudioPage,
});

import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@/components/icons/ui";
import { ToolSearch } from "@/components/shared/ToolSearch";
import { audioCategoryLabels, audioTools } from "@/app/audio-tools-grid";

function AudioPage() {
  return (
    <div className="page-enter space-y-16">
      {/* Back Link + Hero Section */}
      <section className="space-y-8 py-8">
        <Link
          to="/"
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

        <ToolSearch tools={audioTools} categoryLabels={audioCategoryLabels} placeholder="Search audio tools..." />
      </section>

    </div>
  );
}

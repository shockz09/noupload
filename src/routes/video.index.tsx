import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/video/")({
	head: () => ({
		meta: [
			{ title: "Free Online Video Tools - Compress, Trim, Convert Video | noupload" },
			{ name: "description", content: "Free video editing tools that work in your browser. Compress, trim, convert, rotate, resize, and more. No uploads, complete privacy." },
			{ name: "keywords", content: "video compressor, video converter, video trimmer, compress video, video tools online, free video editor" },
			{ property: "og:title", content: "Free Online Video Tools - Compress, Trim, Convert Video" },
			{ property: "og:description", content: "Free video editing tools that work in your browser. No uploads, complete privacy." },
		],
	}),
	component: VideoPage,
});

import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@/components/icons/ui";
import { ToolSearch } from "@/components/shared/ToolSearch";
import { videoCategoryLabels, videoTools } from "@/app/video-tools-grid";

function VideoPage() {
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
            Video tools that <span className="italic">run</span>{" "}
            <span className="relative inline-block">
              locally
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
          Compress, convert, and edit videos entirely in your browser. Hardware-accelerated, no uploads.
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
          <h2 className="text-2xl font-display">Video Tools</h2>
          <div className="flex-1 h-0.5 bg-foreground" />
        </div>

        <ToolSearch tools={videoTools} categoryLabels={videoCategoryLabels} placeholder="Search video tools..." />
      </section>

    </div>
  );
}

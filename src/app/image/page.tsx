import Link from "next/link";
import {
  ImageCompressIcon,
  ResizeIcon,
  ConvertIcon,
  HeicIcon,
  CropIcon,
  RotateIcon,
  MetadataIcon,
  BrightnessIcon,
  FiltersIcon,
  WatermarkIcon,
  BorderIcon,
  Base64Icon,
  FaviconIcon,
  BulkIcon,
  ArrowLeftIcon,
} from "@/components/icons";

const tools = [
  // Wave 1: Essential
  {
    title: "Compress",
    description: "Reduce image file size while keeping quality",
    href: "/image/compress",
    icon: ImageCompressIcon,
    category: "optimize",
    colorClass: "tool-image-compress",
  },
  {
    title: "Resize",
    description: "Change image dimensions with presets or custom sizes",
    href: "/image/resize",
    icon: ResizeIcon,
    category: "edit",
    colorClass: "tool-resize",
  },
  {
    title: "Convert",
    description: "Convert between PNG, JPEG, and WebP formats",
    href: "/image/convert",
    icon: ConvertIcon,
    category: "convert",
    colorClass: "tool-convert",
  },
  {
    title: "HEIC → JPEG",
    description: "Convert iPhone photos to standard JPEG",
    href: "/image/heic-to-jpeg",
    icon: HeicIcon,
    category: "convert",
    colorClass: "tool-heic",
  },
  // Wave 2: Editing
  {
    title: "Crop",
    description: "Crop images with custom aspect ratios",
    href: "/image/crop",
    icon: CropIcon,
    category: "edit",
    colorClass: "tool-crop",
  },
  {
    title: "Rotate & Flip",
    description: "Rotate 90°, 180°, 270° or flip images",
    href: "/image/rotate",
    icon: RotateIcon,
    category: "edit",
    colorClass: "tool-rotate-image",
  },
  {
    title: "Strip Metadata",
    description: "Remove EXIF data and GPS location from photos",
    href: "/image/strip-metadata",
    icon: MetadataIcon,
    category: "privacy",
    colorClass: "tool-strip-metadata",
  },
  // Wave 3: Adjustments
  {
    title: "Adjust",
    description: "Fine-tune brightness, contrast, and saturation",
    href: "/image/adjust",
    icon: BrightnessIcon,
    category: "edit",
    colorClass: "tool-adjust",
  },
  {
    title: "Filters",
    description: "Apply grayscale, sepia, or invert effects",
    href: "/image/filters",
    icon: FiltersIcon,
    category: "edit",
    colorClass: "tool-filters",
  },
  // Wave 4: Extras
  {
    title: "Watermark",
    description: "Add text watermarks to your images",
    href: "/image/watermark",
    icon: WatermarkIcon,
    category: "edit",
    colorClass: "tool-image-watermark",
  },
  {
    title: "Add Border",
    description: "Add a colored border around images",
    href: "/image/border",
    icon: BorderIcon,
    category: "edit",
    colorClass: "tool-border",
  },
  {
    title: "To Base64",
    description: "Convert image to Base64 string for embedding",
    href: "/image/to-base64",
    icon: Base64Icon,
    category: "convert",
    colorClass: "tool-base64",
  },
  // Wave 5: Utilities
  {
    title: "Favicon Generator",
    description: "Generate all favicon sizes from one image",
    href: "/image/favicon",
    icon: FaviconIcon,
    category: "convert",
    colorClass: "tool-favicon",
  },
  {
    title: "Bulk Compress",
    description: "Compress multiple images at once",
    href: "/image/bulk-compress",
    icon: BulkIcon,
    category: "bulk",
    colorClass: "tool-bulk",
  },
  {
    title: "Bulk Resize",
    description: "Resize multiple images at once",
    href: "/image/bulk-resize",
    icon: BulkIcon,
    category: "bulk",
    colorClass: "tool-bulk",
  },
  {
    title: "Bulk Convert",
    description: "Convert multiple images to a new format",
    href: "/image/bulk-convert",
    icon: BulkIcon,
    category: "bulk",
    colorClass: "tool-bulk",
  },
];

const categoryLabels: Record<string, string> = {
  optimize: "Optimize",
  edit: "Edit",
  convert: "Convert",
  privacy: "Privacy",
  bulk: "Bulk",
};

export default function ImagesPage() {
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
            Image tools that{" "}
            <span className="italic">work</span>{" "}
            <span className="relative inline-block">
              offline
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </span>
          </h1>
        </div>

        <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
          Compress, resize, convert, and edit images entirely in your browser. No uploads, no waiting.
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
          <h2 className="text-2xl font-display">Image Tools</h2>
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
              Images never leave your device. Process sensitive photos with confidence.
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
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">All Formats</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              PNG, JPEG, WebP, and even HEIC from iPhones. We handle them all.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

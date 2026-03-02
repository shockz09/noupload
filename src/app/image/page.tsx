"use client";

import Link from "next/link";
import {
  Base64Icon,
  BlurIcon,
  BorderIcon,
  BrightnessIcon,
  BulkIcon,
  CollageIcon,
  ConvertIcon,
  CropIcon,
  FaviconIcon,
  FiltersIcon,
  HeicIcon,
  ImageCompressIcon,
  PaletteIcon,
  RemoveBgIcon,
  ResizeIcon,
  ScreenshotIcon,
} from "@/components/icons/image";
import { MetadataIcon, RotateIcon, WatermarkIcon } from "@/components/icons/pdf";
import { ArrowLeftIcon } from "@/components/icons/ui";
import { ToolSearch } from "@/components/shared/ToolSearch";

const tools = [
  // Featured
  {
    title: "Convert",
    description: "Convert between PNG, JPEG, and WebP formats",
    href: "/image/convert",
    icon: ConvertIcon,
    category: "convert",
    colorClass: "tool-convert",
  },
  {
    title: "Screenshot Beautifier",
    description: "Add gradient backgrounds and frames to screenshots",
    href: "/image/screenshot",
    icon: ScreenshotIcon,
    category: "edit",
    colorClass: "tool-screenshot",
  },
  {
    title: "Remove Background",
    description: "Remove image backgrounds with AI",
    href: "/image/remove-bg",
    icon: RemoveBgIcon,
    category: "ai",
    colorClass: "tool-remove-bg",
  },
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
    title: "HEIC → JPEG",
    description: "Convert iPhone photos to standard JPEG",
    href: "/image/heic-to-jpeg",
    icon: HeicIcon,
    category: "convert",
    colorClass: "tool-heic",
  },
  {
    title: "Strip Metadata",
    description: "Remove EXIF data and GPS location from photos",
    href: "/image/strip-metadata",
    icon: MetadataIcon,
    category: "privacy",
    colorClass: "tool-strip-metadata",
  },
  {
    title: "Resize",
    description: "Change image dimensions with presets or custom sizes",
    href: "/image/resize",
    icon: ResizeIcon,
    category: "edit",
    colorClass: "tool-resize",
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
    colorClass: "tool-bulk-compress",
  },
  {
    title: "Bulk Resize",
    description: "Resize multiple images at once",
    href: "/image/bulk-resize",
    icon: BulkIcon,
    category: "bulk",
    colorClass: "tool-bulk-resize",
  },
  {
    title: "Bulk Convert",
    description: "Convert multiple images to a new format",
    href: "/image/bulk-convert",
    icon: BulkIcon,
    category: "bulk",
    colorClass: "tool-bulk-convert",
  },
  {
    title: "Blur & Pixelate",
    description: "Hide sensitive areas in images",
    href: "/image/blur",
    icon: BlurIcon,
    category: "privacy",
    colorClass: "tool-blur",
  },
  {
    title: "Color Palette",
    description: "Extract dominant colors from images",
    href: "/image/palette",
    icon: PaletteIcon,
    category: "convert",
    colorClass: "tool-palette",
  },
  {
    title: "Collage Maker",
    description: "Combine multiple images into one",
    href: "/image/collage",
    icon: CollageIcon,
    category: "edit",
    colorClass: "tool-collage",
  },
];

const categoryLabels: Record<string, string> = {
  optimize: "Optimize",
  edit: "Edit",
  convert: "Convert",
  privacy: "Privacy",
  bulk: "Bulk",
  ai: "AI",
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
          Back to Tools
        </Link>

        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
            Image tools that <span className="italic">work</span>{" "}
            <span className="relative inline-block">
              offline
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

        <ToolSearch tools={tools} categoryLabels={categoryLabels} placeholder="Search image tools..." />
      </section>

    </div>
  );
}

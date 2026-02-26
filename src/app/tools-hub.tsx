"use client";

import { memo, useCallback, useState } from "react";
// ── Audio tools ──────────────────────────────────────────────
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
// ── Image tools ──────────────────────────────────────────────
import {
  BarcodeIcon,
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
import { ToolSearch } from "@/components/shared/ToolSearch";
import { pdfCategoryLabels, pdfTools } from "./pdf-tools-grid";

const imageTools = [
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

const imageCategoryLabels: Record<string, string> = {
  optimize: "Optimize",
  edit: "Edit",
  convert: "Convert",
  privacy: "Privacy",
  bulk: "Bulk",
  ai: "AI",
};

const audioTools = [
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

const audioCategoryLabels: Record<string, string> = {
  edit: "Edit",
  create: "Create",
  effects: "Effects",
  convert: "Convert",
};

function QRIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="3" height="3" />
      <rect x="18" y="14" width="3" height="3" />
      <rect x="14" y="18" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function QRBulkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="6" height="6" />
      <rect x="15" y="3" width="6" height="6" />
      <rect x="3" y="15" width="6" height="6" />
      <rect x="15" y="15" width="6" height="6" />
    </svg>
  );
}

const qrTools = [
  {
    title: "Generate QR",
    description: "Create QR codes for text, URLs, WiFi, UPI, and more",
    href: "/qr/generate",
    icon: QRIcon,
    category: "create",
    colorClass: "tool-qr-generate",
  },
  {
    title: "Scan QR",
    description: "Use your camera to read any QR code instantly",
    href: "/qr/scan",
    icon: ScanIcon,
    category: "read",
    colorClass: "tool-qr-scan",
  },
  {
    title: "Bulk Generate",
    description: "Create multiple QR codes at once",
    href: "/qr/bulk",
    icon: QRBulkIcon,
    category: "batch",
    colorClass: "tool-qr-bulk",
  },
  {
    title: "Barcode",
    description: "Generate UPC, EAN, Code 128, and more",
    href: "/qr/barcode",
    icon: BarcodeIcon,
    category: "create",
    colorClass: "tool-barcode",
  },
];

const qrCategoryLabels: Record<string, string> = {
  create: "Create",
  read: "Read",
  batch: "Batch",
};

// ── Category definitions ─────────────────────────────────────

type CategoryKey = "pdf" | "image" | "audio" | "qr";

interface CategoryDef {
  key: CategoryKey;
  label: string;
  count: number;
  accentColor: string;
  tools: typeof pdfTools;
  categoryLabels: Record<string, string>;
  placeholder: string;
}

const categories: CategoryDef[] = [
  {
    key: "pdf",
    label: "PDF",
    count: pdfTools.length,
    accentColor: "#C84C1C",
    tools: pdfTools,
    categoryLabels: pdfCategoryLabels,
    placeholder: "Search PDF tools...",
  },
  {
    key: "image",
    label: "Image",
    count: imageTools.length,
    accentColor: "#16A34A",
    tools: imageTools,
    categoryLabels: imageCategoryLabels,
    placeholder: "Search image tools...",
  },
  {
    key: "audio",
    label: "Audio",
    count: audioTools.length,
    accentColor: "#8B5CF6",
    tools: audioTools,
    categoryLabels: audioCategoryLabels,
    placeholder: "Search audio tools...",
  },
  {
    key: "qr",
    label: "QR Code",
    count: qrTools.length,
    accentColor: "#F59E0B",
    tools: qrTools,
    categoryLabels: qrCategoryLabels,
    placeholder: "Search QR tools...",
  },
];

// ── Component ────────────────────────────────────────────────

export const ToolsHub = memo(function ToolsHub() {
  const [active, setActive] = useState<CategoryKey>("pdf");

  const handleSelect = useCallback((key: CategoryKey) => {
    setActive(key);
  }, []);

  const current = categories.find((c) => c.key === active)!;

  return (
    <div className="space-y-8">
      {/* Category pills */}
      <div className="flex flex-wrap gap-3">
        {categories.map((cat) => {
          const isActive = cat.key === active;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleSelect(cat.key)}
              data-active={isActive}
              className="category-pill px-4 py-2 text-sm font-bold cursor-pointer"
              style={{ "--cat-color": cat.accentColor } as React.CSSProperties}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs font-semibold ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active category tools */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display">{current.label} Tools</h2>
          <div className="flex-1 h-0.5 bg-foreground" />
        </div>

        <ToolSearch tools={current.tools} categoryLabels={current.categoryLabels} placeholder={current.placeholder} />
      </section>
    </div>
  );
});

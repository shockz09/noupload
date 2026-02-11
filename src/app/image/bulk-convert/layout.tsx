import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk Convert Images Free - Batch Format Converter",
  description:
    "Convert multiple images to different formats at once for free. JPG, PNG, WebP batch conversion. Works offline, completely private.",
  keywords: [
    "bulk convert images",
    "batch convert",
    "convert multiple images",
    "batch image converter",
    "bulk format conversion",
    "free batch convert",
  ],
  openGraph: {
    title: "Bulk Convert Images Free - Batch Format Converter",
    description: "Convert multiple images to different formats for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Color Palette Free - Get Colors from Image",
  description:
    "Extract color palettes from images for free. Get dominant colors, hex codes, RGB values. Perfect for designers. Works offline, completely private.",
  keywords: [
    "color palette extractor",
    "extract colors",
    "image color palette",
    "get colors from image",
    "color picker",
    "free palette generator",
  ],
  openGraph: {
    title: "Extract Color Palette Free - Get Colors from Image",
    description: "Extract color palettes from any image for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

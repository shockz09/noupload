import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Photo Collage Maker Free - Create Image Collages",
  description:
    "Create photo collages for free. Multiple layout options, customizable spacing. Combine multiple images. Works offline, completely private.",
  keywords: [
    "photo collage",
    "collage maker",
    "image collage",
    "combine photos",
    "collage generator",
    "free collage maker",
  ],
  openGraph: {
    title: "Photo Collage Maker Free - Create Image Collages",
    description: "Create beautiful photo collages for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

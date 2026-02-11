import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remove Image Metadata Free - Strip EXIF Data",
  description:
    "Remove metadata from images for free. Strip EXIF data, GPS location, camera info. Protect your privacy. Works offline.",
  keywords: [
    "remove image metadata",
    "strip exif",
    "remove exif data",
    "image privacy",
    "remove gps from photo",
    "free metadata remover",
  ],
  openGraph: {
    title: "Remove Image Metadata Free - Strip EXIF Data",
    description: "Remove metadata and EXIF data from images for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

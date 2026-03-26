import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Metadata Viewer & Remover - View & Strip EXIF Data Free",
  description:
    "View and remove image metadata for free. Inspect EXIF data, GPS location, camera info, then strip it all. Protect your privacy. Works offline.",
  keywords: [
    "image metadata viewer",
    "view exif data",
    "remove image metadata",
    "strip exif",
    "remove exif data",
    "image privacy",
    "remove gps from photo",
    "free metadata remover",
    "exif viewer",
    "photo metadata",
  ],
  openGraph: {
    title: "Image Metadata Viewer & Remover - View & Strip EXIF Data Free",
    description: "View and remove image metadata and EXIF data for free. Inspect camera info, GPS location, then strip it all. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

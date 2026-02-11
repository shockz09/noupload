import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extract Images from PDF Free - Download All Images",
  description:
    "Extract all images from PDF files for free. Download images in original quality as PNG or JPG. Works offline, your files stay private.",
  keywords: [
    "extract images from pdf",
    "pdf to images",
    "get images from pdf",
    "pdf image extractor",
    "download pdf images",
    "free image extraction",
  ],
  openGraph: {
    title: "Extract Images from PDF Free - Download All Images",
    description: "Extract all images from PDF files for free. Download in original quality. Works 100% offline.",
  },
};

export default function ExtractImagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

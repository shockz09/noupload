import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Image Converter Free - Convert PDF to JPG/PNG",
  description:
    "Convert PDF pages to high-quality images for free. Export as JPG or PNG, choose quality settings. Works offline, no uploads required.",
  keywords: [
    "pdf to image",
    "pdf to jpg",
    "pdf to png",
    "convert pdf to image",
    "pdf converter",
    "extract images from pdf",
  ],
  openGraph: {
    title: "PDF to Image Converter Free - Convert PDF to JPG/PNG",
    description: "Convert PDF pages to high-quality JPG or PNG images for free. Works 100% offline.",
  },
};

export default function PdfToImagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

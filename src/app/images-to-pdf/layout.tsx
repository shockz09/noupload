import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image to PDF Converter Free - Convert JPG/PNG to PDF",
  description: "Convert images to PDF for free. Combine multiple photos into one PDF, reorder and rotate. Works offline in your browser.",
  keywords: ["image to pdf", "jpg to pdf", "png to pdf", "convert image to pdf", "photo to pdf", "pictures to pdf"],
  openGraph: {
    title: "Image to PDF Converter Free - Convert JPG/PNG to PDF",
    description: "Convert images to PDF for free. Combine multiple photos into one PDF. Works 100% offline.",
  },
};

export default function ImagesToPdfLayout({ children }: { children: React.ReactNode }) {
  return children;
}

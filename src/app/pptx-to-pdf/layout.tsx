import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PPTX to PDF Converter Free - Convert PowerPoint to PDF",
  description:
    "Convert PowerPoint presentations to PDF for free. Supports PPTX, PPT, ODP, PPTM. LibreOffice-quality rendering runs 100% in your browser — your files never leave your device.",
  keywords: [
    "pptx to pdf",
    "powerpoint to pdf",
    "convert pptx",
    "ppt to pdf",
    "presentation to pdf",
    "odp to pdf",
    "free pptx converter",
    "offline pptx to pdf",
  ],
  openGraph: {
    title: "PPTX to PDF Converter Free - Convert PowerPoint to PDF",
    description:
      "Convert PowerPoint presentations to PDF for free. LibreOffice-quality rendering, works 100% offline in your browser.",
  },
};

export default function PptxToPdfLayout({ children }: { children: React.ReactNode }) {
  return children;
}

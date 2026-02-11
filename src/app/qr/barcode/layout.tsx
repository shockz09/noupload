import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Barcode Generator Free - Create Barcodes Online",
  description:
    "Generate barcodes for free. Create Code128, EAN, UPC, Code39 and more. Download as PNG or SVG. Works offline, completely private.",
  keywords: [
    "barcode generator",
    "create barcode",
    "barcode maker",
    "code128 generator",
    "ean barcode",
    "free barcode generator",
  ],
  openGraph: {
    title: "Barcode Generator Free - Create Barcodes Online",
    description: "Generate barcodes in multiple formats for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

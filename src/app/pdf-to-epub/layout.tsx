import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to EPUB Free - Convert PDF to Ebook Online",
  description:
    "Convert PDF to EPUB ebook format for free. Automatically detects chapters and formatting. Works 100% in your browser — no upload needed.",
  keywords: ["pdf to epub", "convert pdf to epub", "pdf to ebook", "pdf epub converter", "pdf to epub online free"],
  openGraph: {
    title: "PDF to EPUB Free - Convert PDF to Ebook",
    description:
      "Convert PDFs to EPUB ebook format with automatic chapter detection. Works 100% offline in your browser.",
  },
};

export default function PdfToEpubLayout({ children }: { children: React.ReactNode }) {
  return children;
}

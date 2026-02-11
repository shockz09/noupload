import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Markdown to PDF Converter Free - Export MD with Math Support",
  description:
    "Convert Markdown to PDF for free. Full LaTeX math equation support, syntax highlighting, tables, and more. Live preview. Works offline, completely private.",
  keywords: [
    "markdown to pdf",
    "convert markdown to pdf",
    "md to pdf",
    "markdown pdf converter",
    "latex to pdf",
    "markdown math pdf",
    "free markdown converter",
  ],
  openGraph: {
    title: "Markdown to PDF Converter Free - Export MD with Math Support",
    description: "Convert Markdown to PDF with LaTeX math support. Live preview. Works 100% offline.",
  },
};

export default function MarkdownToPdfLayout({ children }: { children: React.ReactNode }) {
  return children;
}

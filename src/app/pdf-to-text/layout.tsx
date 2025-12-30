import { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Text Free - Extract Text from PDF Online",
  description: "Extract text from PDF for free. Convert PDF to plain text file. Copy or download extracted content. Works 100% in your browser.",
  keywords: ["pdf to text", "extract text from pdf", "pdf text extractor", "convert pdf to txt", "pdf to txt"],
  openGraph: {
    title: "PDF to Text Free - Extract Text from PDF",
    description: "Extract all text from PDFs. Copy or download as .txt file. Works 100% offline.",
  },
};

export default function PdfToTextLayout({ children }: { children: React.ReactNode }) {
  return children;
}

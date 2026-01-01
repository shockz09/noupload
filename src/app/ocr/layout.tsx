import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "PDF OCR Online Free - Extract Text from Scanned PDF",
	description:
		"Extract text from scanned PDFs and images using OCR for free. Supports multiple languages. Works offline, your documents stay private.",
	keywords: [
		"pdf ocr",
		"extract text from pdf",
		"scanned pdf to text",
		"ocr online",
		"image to text",
		"free ocr",
	],
	openGraph: {
		title: "PDF OCR Online Free - Extract Text from Scanned PDF",
		description:
			"Extract text from scanned PDFs and images using OCR for free. Works 100% offline.",
	},
};

export default function OcrLayout({ children }: { children: React.ReactNode }) {
	return children;
}

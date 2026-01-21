import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Convert PDF to Grayscale Free - Black and White PDF",
	description:
		"Convert color PDFs to grayscale for free. Create black and white PDFs for printing. Reduce file size. Works offline, completely private.",
	keywords: [
		"pdf to grayscale",
		"black and white pdf",
		"convert pdf grayscale",
		"pdf color to bw",
		"grayscale pdf converter",
		"free grayscale pdf",
	],
	openGraph: {
		title: "Convert PDF to Grayscale Free - Black and White PDF",
		description:
			"Convert color PDFs to grayscale for free. Perfect for printing. Works 100% offline.",
	},
};

export default function GrayscaleLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

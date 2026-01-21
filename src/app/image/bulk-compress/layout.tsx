import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Bulk Compress Images Free - Batch Image Compressor",
	description:
		"Compress multiple images at once for free. Batch compression with quality control. Works offline, your files stay private.",
	keywords: [
		"bulk compress images",
		"batch compress",
		"compress multiple images",
		"batch image compressor",
		"bulk image compression",
		"free batch compress",
	],
	openGraph: {
		title: "Bulk Compress Images Free - Batch Image Compressor",
		description:
			"Compress multiple images at once for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

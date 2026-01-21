import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Bulk Resize Images Free - Batch Image Resizer",
	description:
		"Resize multiple images at once for free. Batch resize with consistent dimensions. Works offline, your files stay private.",
	keywords: [
		"bulk resize images",
		"batch resize",
		"resize multiple images",
		"batch image resizer",
		"bulk image resize",
		"free batch resize",
	],
	openGraph: {
		title: "Bulk Resize Images Free - Batch Image Resizer",
		description:
			"Resize multiple images at once for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

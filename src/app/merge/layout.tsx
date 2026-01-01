import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Merge PDF Files Online Free - Combine PDFs",
	description:
		"Combine multiple PDF files into one document for free. Drag and drop to reorder pages. Works offline in your browser, no file uploads.",
	keywords: [
		"merge pdf",
		"combine pdf",
		"join pdf",
		"pdf merger",
		"free pdf combiner",
		"merge pdf online",
	],
	openGraph: {
		title: "Merge PDF Files Online Free - Combine PDFs",
		description:
			"Combine multiple PDF files into one document for free. Works 100% offline in your browser.",
	},
};

export default function MergeLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

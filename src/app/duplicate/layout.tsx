import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Duplicate PDF Pages Free - Copy Pages Online",
	description:
		"Duplicate PDF pages for free. Select and copy pages to append to your document. Works 100% in your browser.",
	keywords: [
		"duplicate pdf pages",
		"copy pdf pages",
		"clone pdf pages",
		"repeat pdf pages",
	],
	openGraph: {
		title: "Duplicate PDF Pages Free",
		description: "Select and duplicate pages in your PDF. Works 100% offline.",
	},
};

export default function DuplicateLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

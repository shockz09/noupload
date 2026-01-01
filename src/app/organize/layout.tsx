import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Organize PDF Pages Free - Rearrange, Reorder & Delete",
	description:
		"Rearrange PDF pages for free. Drag and drop to reorder, delete unwanted pages. Works 100% in your browser with complete privacy.",
	keywords: [
		"organize pdf",
		"rearrange pdf pages",
		"reorder pdf",
		"delete pdf pages",
		"pdf page order",
		"rearrange pages",
	],
	openGraph: {
		title: "Organize PDF Pages Free - Rearrange & Reorder",
		description:
			"Drag and drop to rearrange PDF pages. Delete unwanted pages. Works 100% offline.",
	},
};

export default function OrganizeLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

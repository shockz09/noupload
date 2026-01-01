import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Split PDF Online Free - Extract Pages from PDF",
	description:
		"Split PDF into multiple files or extract specific pages for free. Select pages visually, download instantly. No uploads, works offline.",
	keywords: [
		"split pdf",
		"extract pdf pages",
		"pdf splitter",
		"separate pdf",
		"free pdf split",
		"divide pdf",
	],
	openGraph: {
		title: "Split PDF Online Free - Extract Pages from PDF",
		description:
			"Split PDF into multiple files or extract specific pages for free. Works 100% offline.",
	},
};

export default function SplitLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

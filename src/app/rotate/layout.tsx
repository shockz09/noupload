import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Rotate PDF Online Free - Rotate PDF Pages",
	description:
		"Rotate PDF pages 90, 180, or 270 degrees for free. Rotate individual pages or entire document. Works offline, no uploads needed.",
	keywords: [
		"rotate pdf",
		"rotate pdf pages",
		"pdf rotation",
		"turn pdf",
		"flip pdf",
		"rotate pdf online",
	],
	openGraph: {
		title: "Rotate PDF Online Free - Rotate PDF Pages",
		description:
			"Rotate PDF pages for free. Works 100% offline, no uploads needed.",
	},
};

export default function RotateLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

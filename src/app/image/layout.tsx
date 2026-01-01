import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Free Online Image Tools - Compress, Resize, Convert Images",
	description:
		"Free image editing tools that work in your browser. Compress, resize, crop, convert, add filters and more. No uploads, your images stay private.",
	keywords: [
		"image editor",
		"image compressor",
		"resize image",
		"convert image",
		"image tools online",
		"free image editor",
	],
	openGraph: {
		title: "Free Online Image Tools - Compress, Resize, Convert Images",
		description:
			"Free image editing tools that work in your browser. No uploads, your images stay private.",
	},
};

export default function ImageLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}

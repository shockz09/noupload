import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Image Filters Free - Apply Photo Effects Online",
	description:
		"Apply filters to images for free. Grayscale, sepia, invert, vintage, and artistic effects. Works offline, completely private.",
	keywords: [
		"image filters",
		"photo filters",
		"photo effects",
		"grayscale filter",
		"sepia filter",
		"free image filters",
	],
	openGraph: {
		title: "Image Filters Free - Apply Photo Effects Online",
		description:
			"Apply beautiful filters to images for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

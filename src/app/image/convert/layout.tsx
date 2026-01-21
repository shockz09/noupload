import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Convert Image Free - JPG PNG WebP GIF Converter",
	description:
		"Convert images between formats for free. JPG, PNG, WebP, GIF, BMP, and more. Works offline, your files stay private.",
	keywords: [
		"convert image",
		"image converter",
		"jpg to png",
		"png to jpg",
		"webp converter",
		"free image converter",
	],
	openGraph: {
		title: "Convert Image Free - JPG PNG WebP GIF Converter",
		description:
			"Convert images between formats for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

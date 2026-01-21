import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "HEIC to JPEG Converter Free - Convert iPhone Photos",
	description:
		"Convert HEIC to JPEG for free. Transform iPhone photos to JPG format. Batch conversion supported. Works offline, completely private.",
	keywords: [
		"heic to jpeg",
		"heic to jpg",
		"convert heic",
		"iphone photo converter",
		"heic converter",
		"free heic to jpeg",
	],
	openGraph: {
		title: "HEIC to JPEG Converter Free - Convert iPhone Photos",
		description:
			"Convert HEIC photos to JPEG for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

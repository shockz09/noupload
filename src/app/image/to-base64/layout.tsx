import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Image to Base64 Converter Free - Encode Images Online",
	description:
		"Convert images to Base64 for free. Encode JPG, PNG, WebP to Base64 string. Copy or download. Works offline, completely private.",
	keywords: [
		"image to base64",
		"base64 encoder",
		"convert image base64",
		"base64 image",
		"encode image",
		"free base64 converter",
	],
	openGraph: {
		title: "Image to Base64 Converter Free - Encode Images Online",
		description:
			"Convert images to Base64 encoding for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

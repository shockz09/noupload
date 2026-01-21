import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Blur Image Free - Add Blur Effect Online",
	description:
		"Add blur effect to images for free. Gaussian blur, motion blur, and more. Adjust blur intensity. Works offline, completely private.",
	keywords: [
		"blur image",
		"add blur",
		"image blur effect",
		"gaussian blur",
		"blur photo",
		"free blur tool",
	],
	openGraph: {
		title: "Blur Image Free - Add Blur Effect Online",
		description:
			"Add blur effects to images for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

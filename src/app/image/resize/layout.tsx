import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Resize Image Free - Change Image Dimensions Online",
	description:
		"Resize images for free. Change width, height, or scale by percentage. Maintain aspect ratio. Works offline, your files stay private.",
	keywords: [
		"resize image",
		"change image size",
		"image resizer",
		"scale image",
		"reduce image dimensions",
		"free image resize",
	],
	openGraph: {
		title: "Resize Image Free - Change Image Dimensions Online",
		description:
			"Resize images for free. Change dimensions easily. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

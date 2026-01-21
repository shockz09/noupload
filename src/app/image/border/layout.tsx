import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Add Border to Image Free - Photo Frame Generator",
	description:
		"Add borders to images for free. Choose color, width, and style. Create photo frames. Works offline, your files stay private.",
	keywords: [
		"image border",
		"add border",
		"photo frame",
		"border generator",
		"picture frame",
		"free border tool",
	],
	openGraph: {
		title: "Add Border to Image Free - Photo Frame Generator",
		description:
			"Add borders and frames to images for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

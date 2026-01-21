import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Website Screenshot Free - Capture Web Pages",
	description:
		"Take website screenshots for free. Capture full page or viewport. Multiple device sizes. Works in your browser, completely private.",
	keywords: [
		"website screenshot",
		"capture webpage",
		"screenshot tool",
		"web page capture",
		"url to image",
		"free screenshot tool",
	],
	openGraph: {
		title: "Website Screenshot Free - Capture Web Pages",
		description:
			"Take website screenshots for free. Works in your browser.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

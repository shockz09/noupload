import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Adjust Audio Volume Free - Increase or Decrease Volume",
	description:
		"Adjust audio volume for free. Increase or decrease volume levels. Amplify or reduce sound. Works offline, completely private.",
	keywords: [
		"audio volume",
		"adjust volume",
		"increase volume",
		"decrease volume",
		"audio amplifier",
		"free volume adjuster",
	],
	openGraph: {
		title: "Adjust Audio Volume Free - Increase or Decrease Volume",
		description:
			"Adjust audio volume levels for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

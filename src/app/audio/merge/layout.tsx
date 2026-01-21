import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Merge Audio Free - Combine Audio Files Online",
	description:
		"Merge multiple audio files for free. Combine MP3, WAV, and other formats. Reorder tracks. Works offline, completely private.",
	keywords: [
		"merge audio",
		"combine audio",
		"audio merger",
		"join audio files",
		"concatenate audio",
		"free audio merger",
	],
	openGraph: {
		title: "Merge Audio Free - Combine Audio Files Online",
		description:
			"Merge multiple audio files for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

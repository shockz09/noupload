import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Trim Audio Free - Cut & Clip Audio Online",
	description:
		"Trim audio files for free. Cut, clip, and extract portions of audio. Visual waveform editor. Works offline, your files stay private.",
	keywords: [
		"trim audio",
		"cut audio",
		"audio trimmer",
		"clip audio",
		"audio cutter",
		"free audio trimmer",
	],
	openGraph: {
		title: "Trim Audio Free - Cut & Clip Audio Online",
		description:
			"Trim and cut audio files for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

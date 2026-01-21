import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Remove Audio Noise Free - Denoise Audio Online",
	description:
		"Remove background noise from audio for free. Clean up recordings, reduce hiss and hum. Works offline, completely private.",
	keywords: [
		"remove audio noise",
		"denoise audio",
		"noise reduction",
		"clean audio",
		"remove background noise",
		"free audio denoiser",
	],
	openGraph: {
		title: "Remove Audio Noise Free - Denoise Audio Online",
		description:
			"Remove background noise from audio for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

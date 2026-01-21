import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Extract Audio from Video Free - Video to Audio",
	description:
		"Extract audio from video files for free. Convert MP4, MOV, AVI to MP3, WAV. Works offline, your files stay private.",
	keywords: [
		"extract audio",
		"video to audio",
		"extract audio from video",
		"mp4 to mp3",
		"audio extractor",
		"free audio extraction",
	],
	openGraph: {
		title: "Extract Audio from Video Free - Video to Audio",
		description:
			"Extract audio from video files for free. Works 100% offline.",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Convert Audio Free - MP3 WAV OGG M4A Converter",
  description:
    "Convert audio between formats for free. MP3, WAV, OGG, M4A, AAC, FLAC. Extract audio from video. Works offline, completely private.",
  keywords: [
    "audio converter",
    "convert audio",
    "mp3 converter",
    "wav converter",
    "audio format converter",
    "free audio converter",
  ],
  openGraph: {
    title: "Convert Audio Free - MP3 WAV OGG M4A Converter",
    description: "Convert audio between formats for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Record Audio Free - Online Voice Recorder",
  description:
    "Record audio from your microphone for free. Online voice recorder with download. No installation needed. Works in browser, completely private.",
  keywords: [
    "record audio",
    "voice recorder",
    "online recorder",
    "microphone recorder",
    "audio recording",
    "free voice recorder",
  ],
  openGraph: {
    title: "Record Audio Free - Online Voice Recorder",
    description: "Record audio from your microphone for free. Works in your browser.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

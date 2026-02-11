import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remove Silence from Audio Free - Trim Silent Parts",
  description:
    "Remove silence from audio for free. Automatically detect and trim silent portions. Works offline, completely private.",
  keywords: [
    "remove silence",
    "trim silence",
    "audio silence removal",
    "cut silent parts",
    "silence trimmer",
    "free silence remover",
  ],
  openGraph: {
    title: "Remove Silence from Audio Free - Trim Silent Parts",
    description: "Remove silence from audio automatically for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

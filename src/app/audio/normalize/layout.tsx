import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Normalize Audio Free - Adjust Audio Levels",
  description:
    "Normalize audio volume for free. Balance audio levels across files. Consistent loudness. Works offline, your files stay private.",
  keywords: [
    "normalize audio",
    "audio normalization",
    "balance audio",
    "audio levels",
    "loudness normalization",
    "free audio normalizer",
  ],
  openGraph: {
    title: "Normalize Audio Free - Adjust Audio Levels",
    description: "Normalize audio volume for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

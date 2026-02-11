import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Waveform Generator Free - Visualize Audio",
  description:
    "Generate audio waveform visualizations for free. Create waveform images from audio files. Works offline, your files stay private.",
  keywords: [
    "audio waveform",
    "waveform generator",
    "visualize audio",
    "audio visualization",
    "sound wave image",
    "free waveform generator",
  ],
  openGraph: {
    title: "Audio Waveform Generator Free - Visualize Audio",
    description: "Generate audio waveform visualizations for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

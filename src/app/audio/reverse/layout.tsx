import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reverse Audio Free - Play Audio Backwards",
  description:
    "Reverse audio files for free. Play audio backwards. Create unique effects. Works offline, your files stay private.",
  keywords: [
    "reverse audio",
    "audio backwards",
    "reverse sound",
    "backward audio",
    "audio reverser",
    "free audio reverse",
  ],
  openGraph: {
    title: "Reverse Audio Free - Play Audio Backwards",
    description: "Reverse audio files for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

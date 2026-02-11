import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Fade In/Out Free - Add Fade Effects",
  description:
    "Add fade in and fade out effects to audio for free. Smooth audio transitions. Customizable duration. Works offline, completely private.",
  keywords: ["audio fade", "fade in audio", "fade out audio", "audio transition", "fade effect", "free audio fade"],
  openGraph: {
    title: "Audio Fade In/Out Free - Add Fade Effects",
    description: "Add fade in and fade out effects for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

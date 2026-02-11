import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remove Background Free - AI Background Remover",
  description:
    "Remove image backgrounds for free using AI. Automatic detection, clean edges. Perfect for product photos. Works offline, completely private.",
  keywords: [
    "remove background",
    "background remover",
    "remove bg",
    "transparent background",
    "ai background removal",
    "free background remover",
  ],
  openGraph: {
    title: "Remove Background Free - AI Background Remover",
    description: "Remove image backgrounds with AI for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

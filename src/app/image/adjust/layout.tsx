import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adjust Image Free - Brightness, Contrast & Saturation",
  description:
    "Adjust image settings for free. Change brightness, contrast, saturation, and exposure. Fine-tune your photos. Works offline, completely private.",
  keywords: [
    "adjust image",
    "image brightness",
    "image contrast",
    "photo adjustment",
    "image saturation",
    "free image editor",
  ],
  openGraph: {
    title: "Adjust Image Free - Brightness, Contrast & Saturation",
    description: "Adjust image brightness, contrast, and more for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

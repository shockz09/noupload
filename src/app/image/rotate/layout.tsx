import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rotate Image Free - Flip & Rotate Photos Online",
  description:
    "Rotate images for free. Rotate 90°, 180°, 270° or flip horizontally/vertically. Works offline, your files stay private.",
  keywords: ["rotate image", "flip image", "rotate photo", "image rotator", "flip photo", "free image rotate"],
  openGraph: {
    title: "Rotate Image Free - Flip & Rotate Photos Online",
    description: "Rotate and flip images for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

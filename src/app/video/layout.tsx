import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Online Video Tools - Compress, Trim, Convert Video",
  description:
    "Free video editing tools that work in your browser. Compress, trim, convert, rotate, resize, and more. No uploads, complete privacy.",
  keywords: [
    "video compressor",
    "video converter",
    "video trimmer",
    "compress video",
    "video tools online",
    "free video editor",
  ],
  openGraph: {
    title: "Free Online Video Tools - Compress, Trim, Convert Video",
    description: "Free video editing tools that work in your browser. No uploads, complete privacy.",
  },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

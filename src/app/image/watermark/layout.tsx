import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Watermark to Image Free - Text & Logo Watermarks",
  description:
    "Add watermarks to images for free. Text or image watermarks with custom position, opacity, and size. Works offline, completely private.",
  keywords: [
    "image watermark",
    "add watermark",
    "photo watermark",
    "watermark generator",
    "logo watermark",
    "free watermark tool",
  ],
  openGraph: {
    title: "Add Watermark to Image Free - Text & Logo Watermarks",
    description: "Add watermarks to images for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress Image Free - Reduce Image File Size Online",
  description:
    "Compress images for free. Reduce JPG, PNG, WebP file size while keeping quality. Adjust compression level. Works offline, completely private.",
  keywords: [
    "compress image",
    "reduce image size",
    "image compressor",
    "compress jpg",
    "compress png",
    "free image compression",
  ],
  openGraph: {
    title: "Compress Image Free - Reduce Image File Size Online",
    description: "Compress images for free. Reduce file size while keeping quality. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

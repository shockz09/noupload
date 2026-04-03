import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Convert Image Free - JPG PNG WebP SVG Converter",
  description:
    "Convert images between formats for free. JPG, PNG, WebP, SVG to raster, and more. Works offline, your files stay private.",
  keywords: ["convert image", "image converter", "jpg to png", "png to jpg", "webp converter", "svg to png", "free image converter"],
  openGraph: {
    title: "Convert Image Free - JPG PNG WebP SVG Converter",
    description: "Convert images between formats for free. SVG to raster supported. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

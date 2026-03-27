import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Image Free - Add Text, Shapes, Drawings & Signatures",
  description:
    "Annotate and edit images in your browser. Add text, shapes, arrows, freehand drawings, stamps, and signatures. No upload needed.",
  keywords: [
    "edit image",
    "annotate image",
    "draw on image",
    "add text to image",
    "image editor online",
    "image markup",
    "sign image",
    "stamp image",
    "free image editor",
    "browser image editor",
  ],
  openGraph: {
    title: "Edit Image Free - Annotate & Draw on Images",
    description:
      "Add text, shapes, drawings, stamps, and signatures to your images. Everything runs in your browser.",
  },
};

export default function ImageEditLayout({ children }: { children: React.ReactNode }) {
  return children;
}

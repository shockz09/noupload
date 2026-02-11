import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crop Image Free - Cut & Trim Images Online",
  description:
    "Crop images for free. Cut, trim, and adjust image boundaries. Use preset ratios or custom dimensions. Works offline, completely private.",
  keywords: ["crop image", "cut image", "trim image", "image cropper", "photo cropper", "free image crop"],
  openGraph: {
    title: "Crop Image Free - Cut & Trim Images Online",
    description: "Crop images for free. Cut and trim with precision. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

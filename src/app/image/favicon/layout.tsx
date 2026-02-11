import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favicon Generator Free - Create ICO Files Online",
  description:
    "Generate favicons for free. Convert images to ICO format. Create multi-size favicon packages. Works offline, your files stay private.",
  keywords: [
    "favicon generator",
    "create favicon",
    "ico converter",
    "favicon maker",
    "website icon",
    "free favicon generator",
  ],
  openGraph: {
    title: "Favicon Generator Free - Create ICO Files Online",
    description: "Generate favicons from images for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Metadata Editor Free - Edit MP3 ID3 Tags",
  description:
    "Edit audio metadata for free. Change title, artist, album, year, and cover art. ID3 tag editor. Works offline, completely private.",
  keywords: [
    "audio metadata",
    "edit mp3 tags",
    "id3 editor",
    "mp3 tag editor",
    "audio tag editor",
    "free metadata editor",
  ],
  openGraph: {
    title: "Audio Metadata Editor Free - Edit MP3 ID3 Tags",
    description: "Edit audio metadata and ID3 tags for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

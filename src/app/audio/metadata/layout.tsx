import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Metadata Editor Free - View & Edit MP3 ID3 Tags",
  description:
    "View and edit audio metadata for free. Read existing ID3 tags, change title, artist, album, year, genre, and cover art. Strip all tags. Works offline, completely private.",
  keywords: [
    "audio metadata",
    "view mp3 tags",
    "read id3 tags",
    "edit mp3 tags",
    "id3 editor",
    "id3 tag viewer",
    "mp3 tag editor",
    "audio tag editor",
    "strip id3 tags",
    "free metadata editor",
  ],
  openGraph: {
    title: "Audio Metadata Editor Free - View & Edit MP3 ID3 Tags",
    description:
      "View and edit audio metadata and ID3 tags for free. Read existing tags, edit, or strip them. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

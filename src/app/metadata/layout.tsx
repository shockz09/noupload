import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF Metadata Editor & Sanitizer Free - View, Edit & Strip PDF Properties",
  description:
    "View, edit, or strip PDF metadata for free. Change title, author, subject, keywords, or remove all metadata for privacy. Works offline, your files stay private.",
  keywords: [
    "pdf metadata",
    "edit pdf properties",
    "pdf metadata editor",
    "change pdf title",
    "pdf author editor",
    "view pdf metadata",
    "free metadata editor",
    "sanitize pdf",
    "strip pdf metadata",
    "remove pdf metadata",
    "pdf privacy",
    "clean pdf",
  ],
  openGraph: {
    title: "PDF Metadata Editor & Sanitizer Free - View, Edit & Strip Properties",
    description:
      "View, edit, or strip PDF metadata for free. Change title, author, and more — or remove all metadata for privacy. Works 100% offline.",
  },
};

export default function MetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}

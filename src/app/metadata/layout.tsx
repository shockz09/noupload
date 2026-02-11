import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF Metadata Editor Free - View & Edit PDF Properties",
  description:
    "View and edit PDF metadata for free. Change title, author, subject, keywords, and creation date. Works offline, your files stay private.",
  keywords: [
    "pdf metadata",
    "edit pdf properties",
    "pdf metadata editor",
    "change pdf title",
    "pdf author editor",
    "view pdf metadata",
    "free metadata editor",
  ],
  openGraph: {
    title: "PDF Metadata Editor Free - View & Edit PDF Properties",
    description: "View and edit PDF metadata for free. Change title, author, and more. Works 100% offline.",
  },
};

export default function MetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}

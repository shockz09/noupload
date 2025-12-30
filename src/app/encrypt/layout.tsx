import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Encrypt PDF - Password Protect Your Documents",
  description: "Add password protection to your PDF files. Secure your documents with strong encryption. Works 100% in your browser.",
  keywords: ["encrypt pdf", "password protect pdf", "secure pdf", "pdf encryption", "lock pdf"],
  openGraph: {
    title: "Encrypt PDF - Password Protect",
    description: "Add password protection to your PDFs. Works 100% offline.",
  },
};

export default function EncryptLayout({ children }: { children: React.ReactNode }) {
  return children;
}

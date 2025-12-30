import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sanitize PDF Free - Remove Metadata & Hidden Data",
  description: "Remove metadata from PDF for free. Strip author, title, creation date, and hidden data. Protect your privacy. Works 100% in your browser.",
  keywords: ["sanitize pdf", "remove pdf metadata", "strip pdf metadata", "pdf privacy", "remove author pdf", "clean pdf"],
  openGraph: {
    title: "Sanitize PDF Free - Remove Metadata",
    description: "Remove hidden metadata from PDFs. Protect your privacy. Works 100% offline.",
  },
};

export default function SanitizeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

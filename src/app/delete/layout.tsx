import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete PDF Pages Free - Remove Pages Online",
  description:
    "Delete pages from PDF for free. Select and remove unwanted pages from your document. Works 100% in your browser.",
  keywords: ["delete pdf pages", "remove pdf pages", "trim pdf", "cut pdf pages"],
  openGraph: {
    title: "Delete PDF Pages Free",
    description: "Select and delete pages from your PDF. Works 100% offline.",
  },
};

export default function DeleteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

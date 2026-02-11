import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Page Numbers to PDF Free - Customize Position & Format",
  description:
    "Add page numbers to PDF for free. Customize position, format, and font size. Drag to place anywhere. Works 100% in your browser.",
  keywords: ["add page numbers pdf", "pdf page numbers", "number pdf pages", "pdf pagination", "insert page numbers"],
  openGraph: {
    title: "Add Page Numbers to PDF Free",
    description: "Add customizable page numbers to your PDF. Drag to position anywhere. Works 100% offline.",
  },
};

export default function PageNumbersLayout({ children }: { children: React.ReactNode }) {
  return children;
}

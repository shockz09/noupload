import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reverse PDF Pages Free - Flip Page Order Online",
  description: "Reverse PDF page order for free. Flip all pages from last to first. Fix wrongly scanned documents. Works 100% in your browser.",
  keywords: ["reverse pdf pages", "flip pdf order", "reverse page order", "pdf page flip", "invert pdf pages"],
  openGraph: {
    title: "Reverse PDF Pages Free - Flip Page Order",
    description: "Reverse the order of all pages in your PDF. Works 100% offline.",
  },
};

export default function ReverseLayout({ children }: { children: React.ReactNode }) {
  return children;
}

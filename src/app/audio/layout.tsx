import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Online Audio Tools - Trim, Convert, Merge Audio",
  description: "Free audio editing tools that work in your browser. Trim, merge, convert, adjust speed, remove noise, and more. No uploads, complete privacy.",
  keywords: ["audio editor", "audio trimmer", "audio converter", "merge audio", "audio tools online", "free audio editor"],
  openGraph: {
    title: "Free Online Audio Tools - Trim, Convert, Merge Audio",
    description: "Free audio editing tools that work in your browser. No uploads, complete privacy.",
  },
};

export default function AudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}

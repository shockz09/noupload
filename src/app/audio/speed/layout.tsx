import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Audio Speed Free - Speed Up or Slow Down",
  description:
    "Change audio speed for free. Speed up or slow down audio without pitch change. Works offline, your files stay private.",
  keywords: [
    "audio speed",
    "change audio speed",
    "speed up audio",
    "slow down audio",
    "audio tempo",
    "free audio speed changer",
  ],
  openGraph: {
    title: "Change Audio Speed Free - Speed Up or Slow Down",
    description: "Change audio speed without pitch change for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

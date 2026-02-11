import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk QR Code Generator Free - Create Multiple QR Codes",
  description:
    "Generate multiple QR codes at once for free. Bulk create QR codes from a list. Download as ZIP. Works offline, completely private.",
  keywords: [
    "bulk qr generator",
    "multiple qr codes",
    "batch qr code",
    "qr code batch",
    "mass qr generator",
    "free bulk qr",
  ],
  openGraph: {
    title: "Bulk QR Code Generator Free - Create Multiple QR Codes",
    description: "Generate multiple QR codes at once for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

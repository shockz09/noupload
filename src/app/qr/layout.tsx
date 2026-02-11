import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Code Generator Free - Create QR Codes Online",
  description:
    "Generate QR codes for free. Create QR codes for URLs, text, WiFi, and more. Customize colors and download as PNG. Works offline.",
  keywords: ["qr code generator", "create qr code", "qr code maker", "free qr code", "qr code online", "generate qr"],
  openGraph: {
    title: "QR Code Generator Free - Create QR Codes Online",
    description: "Generate QR codes for free. Customize and download instantly. Works 100% offline.",
  },
};

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return children;
}

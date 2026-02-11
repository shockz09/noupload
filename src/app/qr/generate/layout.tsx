import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Code Generator Free - Create QR Codes Online",
  description:
    "Generate QR codes for free. Create QR codes for URLs, text, WiFi, email, phone, and more. Customizable colors and styles. Works offline, completely private.",
  keywords: ["qr code generator", "create qr code", "qr maker", "free qr code", "qr code creator", "custom qr code"],
  openGraph: {
    title: "QR Code Generator Free - Create QR Codes Online",
    description: "Generate QR codes for URLs, text, WiFi and more for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

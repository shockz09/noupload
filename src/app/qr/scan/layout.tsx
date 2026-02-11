import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Code Scanner Free - Scan QR Codes Online",
  description:
    "Scan QR codes for free using your camera or upload an image. Decode any QR code instantly. Works offline, your data stays private.",
  keywords: ["qr code scanner", "scan qr code", "qr reader", "decode qr code", "qr code decoder", "free qr scanner"],
  openGraph: {
    title: "QR Code Scanner Free - Scan QR Codes Online",
    description: "Scan QR codes with camera or image upload for free. Works 100% offline.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

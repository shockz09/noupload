import { BarcodeIcon } from "@/components/icons/image";

function QRIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="3" height="3" />
      <rect x="18" y="14" width="3" height="3" />
      <rect x="14" y="18" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function QRBulkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="6" height="6" />
      <rect x="15" y="3" width="6" height="6" />
      <rect x="3" y="15" width="6" height="6" />
      <rect x="15" y="15" width="6" height="6" />
    </svg>
  );
}

export const qrTools = [
  {
    title: "Generate QR",
    description: "Create QR codes for text, URLs, WiFi, UPI, and more",
    href: "/qr/generate",
    icon: QRIcon,
    category: "create",
    colorClass: "tool-qr-generate",
  },
  {
    title: "Scan QR",
    description: "Use your camera to read any QR code instantly",
    href: "/qr/scan",
    icon: ScanIcon,
    category: "read",
    colorClass: "tool-qr-scan",
  },
  {
    title: "Bulk Generate",
    description: "Create multiple QR codes at once",
    href: "/qr/bulk",
    icon: QRBulkIcon,
    category: "batch",
    colorClass: "tool-qr-bulk",
  },
  {
    title: "Barcode",
    description: "Generate UPC, EAN, Code 128, and more",
    href: "/qr/barcode",
    icon: BarcodeIcon,
    category: "create",
    colorClass: "tool-barcode",
  },
];

export const qrCategoryLabels: Record<string, string> = {
  create: "Create",
  read: "Read",
  batch: "Batch",
};

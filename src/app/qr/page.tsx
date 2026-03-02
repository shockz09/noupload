"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons/ui";
import { BarcodeIcon } from "@/components/icons/image";
import { ToolSearch } from "@/components/shared/ToolSearch";

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

function BulkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="6" height="6" />
      <rect x="15" y="3" width="6" height="6" />
      <rect x="3" y="15" width="6" height="6" />
      <rect x="15" y="15" width="6" height="6" />
    </svg>
  );
}

const tools = [
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
    icon: BulkIcon,
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

const categoryLabels: Record<string, string> = {
  create: "Create",
  read: "Read",
  batch: "Batch",
};

export default function QRPage() {
  return (
    <div className="page-enter space-y-12">
      {/* Header */}
      <section className="space-y-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Tools
        </Link>

        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
            QR codes,{" "}
            <span className="relative inline-block">
              <span className="italic">instantly</span>
              <svg
                aria-hidden="true"
                className="absolute -bottom-2 left-0 w-full h-3 text-primary"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,8 Q50,0 100,8 T200,8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
        </div>

        <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
          Generate QR codes for any content or scan existing ones. Everything happens in your browser.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-semibold">
          <span>No uploads</span>
          <span className="text-muted-foreground">·</span>
          <span>No servers</span>
          <span className="text-muted-foreground">·</span>
          <span>Free forever</span>
        </div>
      </section>

      {/* Tool Selection */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display">Choose Tool</h2>
          <div className="flex-1 h-0.5 bg-foreground" />
        </div>

        <ToolSearch tools={tools} categoryLabels={categoryLabels} placeholder="Search QR tools..." />
      </section>

    </div>
  );
}

"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, BarcodeIcon, CopyIcon, DownloadIcon } from "@/components/icons";
import { ErrorBox } from "@/components/shared";

type BarcodeFormat = "CODE128" | "EAN13" | "EAN8" | "UPC" | "CODE39" | "ITF14";

const barcodeFormats: { value: BarcodeFormat; label: string; placeholder: string; description: string }[] = [
  { value: "CODE128", label: "Code 128", placeholder: "ABC-12345", description: "Any text or numbers" },
  { value: "EAN13", label: "EAN-13", placeholder: "5901234123457", description: "13 digits (retail)" },
  { value: "EAN8", label: "EAN-8", placeholder: "96385074", description: "8 digits (small items)" },
  { value: "UPC", label: "UPC-A", placeholder: "012345678905", description: "12 digits (US retail)" },
  { value: "CODE39", label: "Code 39", placeholder: "CODE39", description: "Alphanumeric (logistics)" },
  { value: "ITF14", label: "ITF-14", placeholder: "10012345678902", description: "14 digits (shipping)" },
];

// Memoized placeholder barcode icon
const PlaceholderIcon = memo(function PlaceholderIcon() {
  return (
    <svg aria-hidden="true" className="w-32 h-20 mx-auto mb-4 opacity-20" viewBox="0 0 128 80" fill="currentColor">
      <rect x="4" y="8" width="3" height="56" />
      <rect x="10" y="8" width="1" height="56" />
      <rect x="14" y="8" width="2" height="56" />
      <rect x="20" y="8" width="4" height="56" />
      <rect x="28" y="8" width="1" height="56" />
      <rect x="32" y="8" width="3" height="56" />
      <rect x="38" y="8" width="2" height="56" />
      <rect x="44" y="8" width="1" height="56" />
      <rect x="48" y="8" width="4" height="56" />
      <rect x="56" y="8" width="2" height="56" />
      <rect x="62" y="8" width="1" height="56" />
      <rect x="66" y="8" width="3" height="56" />
      <rect x="72" y="8" width="2" height="56" />
      <rect x="78" y="8" width="4" height="56" />
      <rect x="86" y="8" width="1" height="56" />
      <rect x="90" y="8" width="2" height="56" />
      <rect x="96" y="8" width="3" height="56" />
      <rect x="102" y="8" width="1" height="56" />
      <rect x="106" y="8" width="4" height="56" />
      <rect x="114" y="8" width="2" height="56" />
      <rect x="120" y="8" width="3" height="56" />
    </svg>
  );
});

export default function BarcodePage() {
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [value, setValue] = useState("");
  const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(true);

  const currentFormat = barcodeFormats.find((f) => f.value === format)!;

  // Auto-generate barcode on input change (debounced)
  useEffect(() => {
    if (!value.trim()) {
      setBarcodeImage(null);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        JsBarcode(svg, value.trim(), {
          format,
          width: 2,
          height: 80,
          displayValue: showText,
          fontSize: 14,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        setBarcodeImage((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid barcode value for this format");
        setBarcodeImage(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, format, showText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (barcodeImage) URL.revokeObjectURL(barcodeImage);
    };
  }, [barcodeImage]);

  const handleFormatChange = useCallback((newFormat: BarcodeFormat) => {
    setFormat(newFormat);
    setValue("");
    setBarcodeImage(null);
    setError(null);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!barcodeImage) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `barcode-${format.toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = barcodeImage;
  }, [barcodeImage, format]);

  const handleCopy = useCallback(async () => {
    if (!barcodeImage) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        } catch {
          // Clipboard API might not be available
        }
      }, "image/png");
    };
    img.src = barcodeImage;
  }, [barcodeImage]);

  return (
    <div className="page-enter max-w-6xl mx-auto space-y-8">
      <Link
        href="/qr"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to QR Tools
      </Link>

      <div className="flex items-start gap-6">
        <div className="tool-icon tool-barcode" style={{ width: 64, height: 64 }}>
          <BarcodeIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display">Barcode Generator</h1>
          <p className="text-muted-foreground mt-2">Create barcodes for products, inventory, and shipping</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column: Barcode Preview */}
        <div className="space-y-4">
          <div className="p-6 bg-card border-2 border-foreground">
            <div className="flex flex-col items-center justify-center min-h-[240px]">
              {barcodeImage ? (
                <div className="bg-white p-6 border-2 border-foreground shadow-[6px_6px_0_0_#1A1612]">
                  <img src={barcodeImage} alt="Generated Barcode" className="max-w-full h-auto" />
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <PlaceholderIcon />
                  <p className="font-medium">Barcode preview</p>
                  <p className="text-sm">Enter a value to generate</p>
                </div>
              )}
            </div>
          </div>

          {barcodeImage && (
            <div className="flex gap-2 animate-fade-up">
              <button type="button" onClick={handleDownload} className="btn-success flex-1">
                <DownloadIcon className="w-5 h-5" />
                Download PNG
              </button>
              <button type="button" onClick={handleCopy} className="btn-success px-3" title="Copy to clipboard">
                <CopyIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-6">
          <div className="p-6 bg-card border-2 border-foreground space-y-6">
            {/* Format Selection */}
            <div className="space-y-3">
              <span className="input-label">Barcode Format</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {barcodeFormats.map((f) => (
                  <button
                    type="button"
                    key={f.value}
                    onClick={() => handleFormatChange(f.value)}
                    className={`p-3 text-center border-2 border-foreground transition-all ${
                      format === f.value ? "bg-foreground text-background" : "bg-card hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm font-bold block">{f.label}</span>
                    <span className={`text-xs ${format === f.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {f.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Value Input */}
            <div className="space-y-2">
              <label htmlFor="barcode-value" className="input-label">
                Barcode Value
              </label>
              <input
                id="barcode-value"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={currentFormat.placeholder}
                className="input-field w-full text-lg"
              />
              <p className="text-xs text-muted-foreground">{currentFormat.description}</p>
            </div>

            {/* Show Text Toggle */}
            <div className="flex items-center justify-between py-3 border-t border-muted">
              <span className="text-sm font-medium">Show text below barcode</span>
              <button
                type="button"
                onClick={() => setShowText(!showText)}
                className={`relative w-12 h-6 border-2 border-foreground transition-colors ${
                  showText ? "bg-foreground" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-background border border-foreground transition-transform ${
                    showText ? "left-6" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {error && <ErrorBox message={error} />}
          </div>

          {/* Info Box */}
          <div className="info-box">
            <svg
              aria-hidden="true"
              className="w-5 h-5 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">Format Tips</p>
              <p className="text-muted-foreground">
                <strong>EAN/UPC</strong> for retail products. <strong>Code 128</strong> for any text.{" "}
                <strong>ITF-14</strong> for shipping cartons.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

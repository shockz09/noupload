"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, CopyIcon, DownloadIcon, LoaderIcon } from "@/components/icons/ui";
import { QRCustomizePanel } from "@/components/qr/customize-panel";
import { ErrorBox } from "@/components/shared";
import { getErrorMessage } from "@/lib/error";
import { copyImageToClipboard } from "@/lib/image-utils";
import {
  downloadQR,
  generateQRBlob,
  generateQRBlobWithLogo,
  generateQRDataURL,
  generateQRWithLogo,
} from "@/lib/qr-utils";

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

interface QRPreview {
  text: string;
  dataUrl: string;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function BulkQRGeneratePage() {
  const [inputText, setInputText] = useState("");
  const [previews, setPreviews] = useState<QRPreview[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Customization
  const [showCustomize, setShowCustomize] = useState(false);
  const [darkColor, setDarkColor] = useState("#000000");
  const [lightColor, setLightColor] = useState("#FFFFFF");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoPadding, setLogoPadding] = useState(true);

  // Memoize parsed items to prevent recalculation on every render
  const items = useMemo(() => inputText.split("\n").filter((line) => line.trim().length > 0), [inputText]);

  // Memoize color options object
  const colorOptions = useMemo(() => ({ color: { dark: darkColor, light: lightColor } }), [darkColor, lightColor]);

  // Auto-generate previews (debounced)
  useEffect(() => {
    if (items.length === 0) {
      setPreviews([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const generated: QRPreview[] = [];

        for (const text of items.slice(0, 20)) {
          // Limit to 20 previews
          let dataUrl: string;
          if (logo) {
            dataUrl = await generateQRWithLogo(text.trim(), logo, {
              width: 200,
              ...colorOptions,
              logoPadding,
            });
          } else {
            dataUrl = await generateQRDataURL(text.trim(), {
              width: 200,
              ...colorOptions,
            });
          }
          generated.push({ text: text.trim(), dataUrl });
        }

        setPreviews(generated);
      } catch {
        // Silently fail for preview generation
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [inputText, darkColor, lightColor, logo, logoPadding]);

  const handleDownloadAll = async () => {
    if (items.length === 0) return;

    setIsDownloading(true);
    setError(null);

    try {
      const blobs = await Promise.all(
        items.map(async (item) => {
          const text = item.trim();
          if (logo) {
            return generateQRBlobWithLogo(text, logo, {
              width: 600,
              ...colorOptions,
              logoPadding,
            });
          }
          return generateQRBlob(text, { width: 600, ...colorOptions });
        }),
      );

      for (let i = 0; i < blobs.length; i++) {
        downloadQR(blobs[i], `qrcode-${i + 1}.png`);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to download QR codes"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadOne = async (text: string, index: number) => {
    try {
      let blob: Blob;
      if (logo) {
        blob = await generateQRBlobWithLogo(text, logo, {
          width: 600,
          ...colorOptions,
          logoPadding,
        });
      } else {
        blob = await generateQRBlob(text, { width: 600, ...colorOptions });
      }
      downloadQR(blob, `qrcode-${index + 1}.png`);
    } catch {
      // Silently fail
    }
  };

  const handleCopyOne = async (text: string, index: number) => {
    try {
      let blob: Blob;
      if (logo) {
        blob = await generateQRBlobWithLogo(text, logo, {
          width: 600,
          ...colorOptions,
          logoPadding,
        });
      } else {
        blob = await generateQRBlob(text, { width: 600, ...colorOptions });
      }
      await copyImageToClipboard(blob);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Silently fail
    }
  };

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
        <div className="tool-icon tool-qr-generate" style={{ width: 64, height: 64 }}>
          <QRIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display">Bulk QR Generate</h1>
          <p className="text-muted-foreground mt-2">Create multiple QR codes at once</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column: Preview Grid */}
        <div className="space-y-4">
          <div className="p-6 bg-card border-2 border-foreground min-h-[400px] max-h-[500px] overflow-y-auto">
            {previews.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {previews.map((preview, index) => (
                    <div key={preview.text} className="space-y-1 group relative">
                      <div className="bg-white p-2 border border-foreground/20 relative">
                        <img
                          src={preview.dataUrl}
                          alt={`QR ${index + 1}`}
                          className="w-full"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleDownloadOne(preview.text, index)}
                            className="p-2 bg-white rounded hover:scale-110 transition-transform"
                            title="Download"
                          >
                            <DownloadIcon className="w-5 h-5 text-black" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyOne(preview.text, index)}
                            className="p-2 bg-white rounded hover:scale-110 transition-transform"
                            title={copiedIndex === index ? "Copied!" : "Copy"}
                            style={copiedIndex === index ? { background: "#2D5A3D" } : undefined}
                          >
                            {copiedIndex === index ? (
                              <CheckIcon className="w-5 h-5 text-white" />
                            ) : (
                              <CopyIcon className="w-5 h-5 text-black" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] font-mono truncate text-muted-foreground" title={preview.text}>
                        {preview.text}
                      </p>
                    </div>
                  ))}
                </div>
                {items.length > 20 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{items.length - 20} more (showing first 20)
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-muted-foreground">
                <QRIcon className="w-20 h-20 mx-auto mb-4 opacity-20" />
                <p className="font-medium">QR codes preview</p>
                <p className="text-sm">Enter items on the right, one per line</p>
              </div>
            )}
          </div>

          {/* Download buttons */}
          {previews.length > 0 && (
            <button type="button" onClick={handleDownloadAll} disabled={isDownloading} className="btn-success w-full">
              {isDownloading ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon className="w-5 h-5" />
                  Download All ({items.length} files)
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-6">
          <div className="p-6 bg-card border-2 border-foreground space-y-6">
            {/* Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="bulk-items" className="input-label">
                  Enter Items (one per line)
                </label>
                <span className="text-sm text-muted-foreground font-medium">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <textarea
                id="bulk-items"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={"https://example.com\nhttps://another-site.com\nSome text here\n..."}
                className="input-field w-full h-40 resize-none font-mono text-sm"
              />
            </div>

            <QRCustomizePanel
              showCustomize={showCustomize}
              setShowCustomize={setShowCustomize}
              darkColor={darkColor}
              setDarkColor={setDarkColor}
              lightColor={lightColor}
              setLightColor={setLightColor}
              logo={logo}
              setLogo={setLogo}
              logoPreview={logoPreview}
              setLogoPreview={setLogoPreview}
              logoPadding={logoPadding}
              setLogoPadding={setLogoPadding}
            />

            {error && <ErrorBox message={error} />}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  generateQRDataURL,
  generateQRBlob,
  downloadQR,
  generateQRWithLogo,
  generateQRBlobWithLogo,
  QR_COLOR_PRESETS,
} from "@/lib/qr-utils";
import { ArrowLeftIcon, DownloadIcon, LoaderIcon } from "@/components/icons";

function QRIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

interface QRResult {
  text: string;
  dataUrl: string;
  blob: Blob;
}

export default function BulkQRGeneratePage() {
  const [inputText, setInputText] = useState("");
  const [results, setResults] = useState<QRResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Customization
  const [showCustomize, setShowCustomize] = useState(false);
  const [darkColor, setDarkColor] = useState("#000000");
  const [lightColor, setLightColor] = useState("#FFFFFF");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoPadding, setLogoPadding] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const items = inputText.split("\n").filter((line) => line.trim().length > 0);

  const handleGenerate = async () => {
    if (items.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: items.length });

    const colorOptions = { color: { dark: darkColor, light: lightColor } };
    const generated: QRResult[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const text = items[i].trim();
        let dataUrl: string;
        let blob: Blob;

        if (logo) {
          dataUrl = await generateQRWithLogo(text, logo, {
            width: 300,
            ...colorOptions,
            logoPadding,
          });
          blob = await generateQRBlobWithLogo(text, logo, {
            width: 600,
            ...colorOptions,
            logoPadding,
          });
        } else {
          dataUrl = await generateQRDataURL(text, { width: 300, ...colorOptions });
          blob = await generateQRBlob(text, { width: 600, ...colorOptions });
        }

        generated.push({ text, dataUrl, blob });
        setProgress({ current: i + 1, total: items.length });
      }

      setResults(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR codes");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadOne = (result: QRResult, index: number) => {
    downloadQR(result.blob, `qrcode-${index + 1}.png`);
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < results.length; i++) {
      downloadQR(results[i].blob, `qrcode-${i + 1}.png`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      setLogoPreview(URL.createObjectURL(file));
      setResults([]);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
    setResults([]);
  };

  const applyPreset = (preset: typeof QR_COLOR_PRESETS[0]) => {
    setDarkColor(preset.dark);
    setLightColor(preset.light);
    setResults([]);
  };

  const handleStartOver = () => {
    setResults([]);
    setInputText("");
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="page-enter space-y-8">
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

      <div className="border-2 border-foreground bg-card">
        <div className="p-6 space-y-6">
          {results.length === 0 ? (
            <>
              {/* Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="input-label">Enter Items (one per line)</label>
                  <span className="text-sm text-muted-foreground font-medium">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="https://example.com&#10;https://another-site.com&#10;Some text here&#10;..."
                  className="input-field w-full h-48 resize-none font-mono text-sm"
                  disabled={isProcessing}
                />
              </div>

              {/* Customization Section */}
              <div className="border-2 border-foreground">
                <button
                  onClick={() => setShowCustomize(!showCustomize)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-muted transition-colors"
                >
                  <span className="font-bold">Customize</span>
                  <ChevronDownIcon className={`w-5 h-5 transition-transform ${showCustomize ? "rotate-180" : ""}`} />
                </button>

                {showCustomize && (
                  <div className="p-4 pt-0 space-y-4 border-t-2 border-foreground">
                    {/* Colors */}
                    <div className="space-y-3">
                      <label className="input-label">Colors</label>
                      <div className="flex flex-wrap gap-2">
                        {QR_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => applyPreset(preset)}
                            className={`px-3 py-2 text-xs font-bold border-2 border-foreground transition-colors ${
                              darkColor === preset.dark && lightColor === preset.light
                                ? "bg-foreground text-background"
                                : "hover:bg-muted"
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={darkColor}
                            onChange={(e) => setDarkColor(e.target.value)}
                            className="w-8 h-8 border-2 border-foreground cursor-pointer"
                          />
                          <span className="text-sm font-medium">Foreground</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={lightColor}
                            onChange={(e) => setLightColor(e.target.value)}
                            className="w-8 h-8 border-2 border-foreground cursor-pointer"
                          />
                          <span className="text-sm font-medium">Background</span>
                        </div>
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="space-y-3">
                      <label className="input-label">Logo (optional)</label>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      {logoPreview ? (
                        <div className="flex items-center gap-4">
                          <img src={logoPreview} alt="Logo preview" className="w-12 h-12 object-contain border-2 border-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium truncate">{logo?.name}</p>
                            <label className="flex items-center gap-2 mt-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={logoPadding}
                                onChange={(e) => setLogoPadding(e.target.checked)}
                                className="w-4 h-4 border-2 border-foreground"
                              />
                              <span className="text-xs">Add padding</span>
                            </label>
                          </div>
                          <button onClick={handleRemoveLogo} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="btn-secondary w-full"
                        >
                          <ImageIcon className="w-5 h-5" />Upload Logo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="error-box animate-shake">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {isProcessing && (
                <div className="space-y-3">
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                    <LoaderIcon className="w-4 h-4" />
                    <span>Generating {progress.current} of {progress.total}...</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={items.length === 0 || isProcessing}
                className="btn-primary w-full"
              >
                {isProcessing ? (
                  <><LoaderIcon className="w-5 h-5" />Generating...</>
                ) : (
                  <><QRIcon className="w-5 h-5" />Generate {items.length} QR Code{items.length !== 1 ? "s" : ""}</>
                )}
              </button>
            </>
          ) : (
            /* Results */
            <div className="space-y-6 animate-fade-up">
              <div className="success-card">
                <div className="success-stamp">
                  <span className="success-stamp-text">Done</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12" /></svg>
                </div>

                <h2 className="text-3xl font-display mb-2">
                  {results.length} QR Code{results.length !== 1 ? "s" : ""} Generated!
                </h2>

                <button onClick={handleDownloadAll} className="btn-success w-full mt-6">
                  <DownloadIcon className="w-5 h-5" />Download All ({results.length} files)
                </button>
              </div>

              {/* QR Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((result, index) => (
                  <div key={index} className="border-2 border-foreground p-3 space-y-2">
                    <div className="bg-white p-2 border border-foreground/20">
                      <img src={result.dataUrl} alt={`QR ${index + 1}`} className="w-full" />
                    </div>
                    <p className="text-xs font-mono truncate text-muted-foreground" title={result.text}>
                      {result.text}
                    </p>
                    <button
                      onClick={() => handleDownloadOne(result, index)}
                      className="btn-secondary w-full text-xs py-2"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={handleStartOver} className="btn-secondary w-full">
                Generate More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

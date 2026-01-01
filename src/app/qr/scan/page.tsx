"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeftIcon, LoaderIcon } from "@/components/icons";

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

const SCANNER_ID = "qr-scanner-element";

export default function QRScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create scanner element outside React's control
  useEffect(() => {
    if (containerRef.current && !document.getElementById(SCANNER_ID)) {
      const scannerDiv = document.createElement("div");
      scannerDiv.id = SCANNER_ID;
      scannerDiv.style.width = "100%";
      scannerDiv.style.minHeight = "320px";
      containerRef.current.appendChild(scannerDiv);
    }

    return () => {
      // Cleanup scanner
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      // Remove scanner element
      const el = document.getElementById(SCANNER_ID);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  // Shared function to process a QR image file
  const processQRFile = useCallback(async (file: File) => {
    // Stop camera if running
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
      setIsScanning(false);
    }

    setError(null);
    setIsProcessingFile(true);

    try {
      const html5QrCode = new Html5Qrcode("qr-file-scanner");
      const result = await html5QrCode.scanFile(file, true);
      setScanResult(result);
      html5QrCode.clear();
    } catch {
      setError("No QR code found in image. Try another image.");
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || scanResult) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) processQRFile(file);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [scanResult, processQRFile]);

  const startScanning = async () => {
    setError(null);

    try {
      const html5QrCode = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10 },
        async (decodedText) => {
          // IMPORTANT: Stop scanner FIRST, before any state changes
          try {
            await html5QrCode.stop();
          } catch {}
          scannerRef.current = null;
          // Only update state AFTER scanner is fully stopped
          setIsScanning(false);
          setScanResult(decodedText);
        },
        () => {} // Ignore errors during scanning
      );
      setIsScanning(true);
    } catch (err) {
      scannerRef.current = null;
      setError(
        err instanceof Error ? err.message : "Failed to access camera. Please allow camera permissions."
      );
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleCopy = async () => {
    if (scanResult) {
      await navigator.clipboard.writeText(scanResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUrl = (text: string) => {
    try { new URL(text); return true; } catch { return false; }
  };

  const handleScanAnother = () => {
    setScanResult(null);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processQRFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        <div className="tool-icon tool-qr-scan" style={{ width: 64, height: 64 }}>
          <ScanIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display">Scan QR Code</h1>
          <p className="text-muted-foreground mt-2">Use your camera or upload an image</p>
        </div>
      </div>

      {/* Hidden elements */}
      <div id="qr-file-scanner" className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="border-2 border-foreground bg-card">
        <div className="p-6 space-y-6">
          {/* Camera View - container managed outside React */}
          <div className={scanResult ? "hidden" : ""}>
            <div
              ref={containerRef}
              className="relative bg-[#1A1612] border-2 border-foreground overflow-hidden"
              style={{ minHeight: 320 }}
            >
              {!isScanning && !scanResult && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none z-10">
                  <ScanIcon className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm">Camera preview will appear here</p>
                </div>
              )}
            </div>
          </div>

          {!scanResult ? (
            <>
              {error && (
                <div className="error-box animate-shake">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <button
                onClick={isScanning ? stopScanning : startScanning}
                disabled={isProcessingFile}
                className={isScanning ? "btn-secondary w-full" : "btn-primary w-full"}
              >
                {isScanning ? (
                  <><LoaderIcon className="w-5 h-5" />Stop Camera</>
                ) : (
                  <><ScanIcon className="w-5 h-5" />Start Camera</>
                )}
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-muted-foreground font-medium">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning || isProcessingFile}
                className="btn-secondary w-full"
              >
                {isProcessingFile ? (
                  <><LoaderIcon className="w-5 h-5" />Processing...</>
                ) : (
                  <><UploadIcon className="w-5 h-5" />Upload QR Image</>
                )}
              </button>

              <div className="info-box">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
                <div className="text-sm">
                  <p className="font-bold text-foreground mb-1">Tips for scanning</p>
                  <p className="text-muted-foreground">
                    Use your camera, upload an image, or paste from clipboard (Ctrl+V). Ensure the QR code is clearly visible.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-fade-up">
              <div className="success-card">
                <div className="success-stamp">
                  <span className="success-stamp-text">Found</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="text-3xl font-display mb-6">QR Code Decoded!</h2>

                <div className="bg-muted border-2 border-foreground p-4 mb-6 text-left">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Content</p>
                  <p className="font-mono text-sm break-all">{scanResult}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {isUrl(scanResult) && (
                    <a
                      href={scanResult}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-success flex-1 text-center"
                    >
                      Open Link
                    </a>
                  )}
                  <button
                    onClick={handleCopy}
                    className={`${isUrl(scanResult) ? "btn-secondary" : "btn-success"} flex-1`}
                  >
                    {copied ? <><CheckIcon className="w-5 h-5" />Copied!</> : <><CopyIcon className="w-5 h-5" />Copy</>}
                  </button>
                </div>
              </div>

              <button
                onClick={handleScanAnother}
                className="btn-secondary w-full"
              >
                Scan Another Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

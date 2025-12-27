"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import {
  generateQRDataURL,
  generateQRBlob,
  downloadQR,
  generateWifiString,
  generateEmailString,
  generateSmsString,
  generatePhoneString,
  QRDataType,
  WifiData,
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

// Content type icons - matching the app's stroke-based style
function TextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V4h16v3" />
      <path d="M12 4v16" />
      <path d="M8 20h8" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6L12 13 2 6" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function SmsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </svg>
  );
}

type ActiveTool = "generate" | "scan" | null;

const dataTypes: { value: QRDataType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: "text", label: "Text", icon: TextIcon },
  { value: "url", label: "URL", icon: LinkIcon },
  { value: "wifi", label: "WiFi", icon: WifiIcon },
  { value: "email", label: "Email", icon: EmailIcon },
  { value: "phone", label: "Phone", icon: PhoneIcon },
  { value: "sms", label: "SMS", icon: SmsIcon },
];

const wifiEncryptions = [
  { value: "WPA", label: "WPA/WPA2" },
  { value: "WEP", label: "WEP" },
  { value: "nopass", label: "None" },
];

export default function QRPage() {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  // Generate state
  const [dataType, setDataType] = useState<QRDataType>("text");
  const [textValue, setTextValue] = useState("");
  const [urlValue, setUrlValue] = useState("https://");
  const [phoneValue, setPhoneValue] = useState("");
  const [wifiData, setWifiData] = useState<WifiData>({
    ssid: "",
    password: "",
    encryption: "WPA",
    hidden: false,
  });
  const [emailData, setEmailData] = useState({ to: "", subject: "", body: "" });
  const [smsData, setSmsData] = useState({ phone: "", message: "" });
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner";

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const getDataString = useCallback((): string => {
    switch (dataType) {
      case "text": return textValue;
      case "url": return urlValue;
      case "wifi": return generateWifiString(wifiData);
      case "email": return generateEmailString(emailData);
      case "phone": return generatePhoneString(phoneValue);
      case "sms": return generateSmsString(smsData);
      default: return "";
    }
  }, [dataType, textValue, urlValue, wifiData, emailData, phoneValue, smsData]);

  const isInputValid = useCallback((): boolean => {
    switch (dataType) {
      case "text": return textValue.trim().length > 0;
      case "url": return urlValue.length > 8;
      case "wifi": return wifiData.ssid.trim().length > 0;
      case "email": return emailData.to.trim().length > 0;
      case "phone": return phoneValue.trim().length > 0;
      case "sms": return smsData.phone.trim().length > 0;
      default: return false;
    }
  }, [dataType, textValue, urlValue, wifiData, emailData, phoneValue, smsData]);

  const handleGenerate = async () => {
    if (!isInputValid()) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const data = getDataString();
      const dataUrl = await generateQRDataURL(data, { width: 400 });
      setQrImage(dataUrl);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!qrImage) return;
    try {
      const data = getDataString();
      const blob = await generateQRBlob(data, { width: 800 });
      downloadQR(blob, "qrcode.png");
    } catch {
      // Download failure is non-critical, QR is already displayed
    }
  };

  const startScanning = async () => {
    setScanError(null);
    setScanResult(null);

    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setScanResult(decodedText);
          html5QrCode.stop().catch(() => {});
          setIsScanning(false);
        },
        () => {}
      );
      setIsScanning(true);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Failed to access camera. Please allow camera permissions."
      );
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
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

  const handleToolSelect = (tool: ActiveTool) => {
    if (activeTool === tool) {
      setActiveTool(null);
    } else {
      // Clear state when switching tools
      if (activeTool === "scan") {
        if (isScanning) stopScanning();
        setScanResult(null);
        setScanError(null);
      }
      if (activeTool === "generate") {
        setQrImage(null);
        setGenerateError(null);
      }
      setActiveTool(tool);
    }
  };

  return (
    <div className="page-enter space-y-12">
      {/* Header */}
      <section className="space-y-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to PDF Tools
        </Link>

        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
            QR codes,{" "}
            <span className="relative inline-block">
              <span className="italic">instantly</span>
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M0,8 Q50,0 100,8 T200,8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
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
          <span>No tracking</span>
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

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Generate Card */}
          <button
            onClick={() => handleToolSelect("generate")}
            className={`tool-card tool-qr-generate group text-left transition-all ${
              activeTool === "generate" ? "ring-4 ring-[#1E4A7C] ring-offset-2" : ""
            }`}
          >
            <span className="category-tag">Create</span>
            <div className="space-y-4">
              <div className="tool-icon tool-qr-generate">
                <QRIcon className="w-6 h-6" />
              </div>
              <div className="space-y-2 pr-12">
                <h3 className="text-xl font-bold text-foreground">Generate QR</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Create QR codes for text, URLs, WiFi, email, phone, and SMS
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                <span>{activeTool === "generate" ? "Selected" : "Select"}</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Scan Card */}
          <button
            onClick={() => handleToolSelect("scan")}
            className={`tool-card tool-qr-scan group text-left transition-all ${
              activeTool === "scan" ? "ring-4 ring-[#7C1E4A] ring-offset-2" : ""
            }`}
          >
            <span className="category-tag">Read</span>
            <div className="space-y-4">
              <div className="tool-icon tool-qr-scan">
                <ScanIcon className="w-6 h-6" />
              </div>
              <div className="space-y-2 pr-12">
                <h3 className="text-xl font-bold text-foreground">Scan QR</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Use your camera to read any QR code instantly
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                <span>{activeTool === "scan" ? "Selected" : "Select"}</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Generate Tool Interface */}
      {activeTool === "generate" && (
        <section className="animate-fade-up">
          <div className="border-2 border-foreground bg-card">
            {/* Tool Header */}
            <div className="flex items-center gap-4 p-6 border-b-2 border-foreground bg-muted/30">
              <div className="tool-icon tool-qr-generate" style={{ width: 48, height: 48 }}>
                <QRIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Generate QR Code</h3>
                <p className="text-sm text-muted-foreground">Fill in the details below</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Data Type Selection */}
              <div className="space-y-3">
                <label className="input-label">Content Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {dataTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => { setDataType(type.value); setQrImage(null); }}
                        className={`p-3 text-center border-2 border-foreground transition-all ${
                          dataType === type.value
                            ? "bg-foreground text-background"
                            : "bg-card hover:bg-muted"
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs font-bold">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Input Fields */}
              <div className="space-y-4">
                {dataType === "text" && (
                  <div className="space-y-2">
                    <label className="input-label">Your Text</label>
                    <textarea
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      placeholder="Enter any text you want to encode..."
                      className="input-field w-full h-32 resize-none"
                    />
                  </div>
                )}

                {dataType === "url" && (
                  <div className="space-y-2">
                    <label className="input-label">Website URL</label>
                    <input
                      type="url"
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      placeholder="https://example.com"
                      className="input-field w-full"
                    />
                  </div>
                )}

                {dataType === "wifi" && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="input-label">Network Name (SSID)</label>
                      <input
                        type="text"
                        value={wifiData.ssid}
                        onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                        placeholder="MyWiFiNetwork"
                        className="input-field w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="input-label">Password</label>
                      <input
                        type="text"
                        value={wifiData.password}
                        onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                        placeholder="••••••••"
                        className="input-field w-full"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="input-label">Security Type</label>
                      <div className="flex gap-2">
                        {wifiEncryptions.map((enc) => (
                          <button
                            key={enc.value}
                            onClick={() => setWifiData({ ...wifiData, encryption: enc.value as WifiData["encryption"] })}
                            className={`flex-1 py-3 text-sm font-bold border-2 border-foreground transition-colors ${
                              wifiData.encryption === enc.value ? "bg-foreground text-background" : "hover:bg-muted"
                            }`}
                          >
                            {enc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {dataType === "email" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="input-label">Email Address</label>
                      <input
                        type="email"
                        value={emailData.to}
                        onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                        placeholder="hello@example.com"
                        className="input-field w-full"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="input-label">Subject (optional)</label>
                        <input
                          type="text"
                          value={emailData.subject}
                          onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                          placeholder="Email subject"
                          className="input-field w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="input-label">Body (optional)</label>
                        <input
                          type="text"
                          value={emailData.body}
                          onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                          placeholder="Email body"
                          className="input-field w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {dataType === "phone" && (
                  <div className="space-y-2">
                    <label className="input-label">Phone Number</label>
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={(e) => setPhoneValue(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="input-field w-full"
                    />
                  </div>
                )}

                {dataType === "sms" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="input-label">Phone Number</label>
                      <input
                        type="tel"
                        value={smsData.phone}
                        onChange={(e) => setSmsData({ ...smsData, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        className="input-field w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="input-label">Message (optional)</label>
                      <textarea
                        value={smsData.message}
                        onChange={(e) => setSmsData({ ...smsData, message: e.target.value })}
                        placeholder="Pre-filled message..."
                        className="input-field w-full h-24 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {generateError && (
                <div className="error-box animate-shake">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="font-medium">{generateError}</span>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!isInputValid() || isGenerating}
                className="btn-primary w-full"
              >
                {isGenerating ? (
                  <><LoaderIcon className="w-5 h-5" />Generating...</>
                ) : (
                  <><QRIcon className="w-5 h-5" />Generate QR Code</>
                )}
              </button>

              {/* QR Code Result */}
              {qrImage && (
                <div className="pt-6 border-t-2 border-foreground space-y-6 animate-fade-up">
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 sm:p-8 border-2 border-foreground shadow-[4px_4px_0_0_#1A1612] sm:shadow-[8px_8px_0_0_#1A1612]">
                      <img src={qrImage} alt="Generated QR Code" className="w-48 h-48 sm:w-64 sm:h-64" />
                    </div>
                  </div>
                  <button onClick={handleDownload} className="btn-success w-full">
                    <DownloadIcon className="w-5 h-5" />Download PNG (High Resolution)
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Scan Tool Interface */}
      {activeTool === "scan" && (
        <section className="animate-fade-up">
          <div className="border-2 border-foreground bg-card">
            {/* Tool Header */}
            <div className="flex items-center gap-4 p-6 border-b-2 border-foreground bg-muted/30">
              <div className="tool-icon tool-qr-scan" style={{ width: 48, height: 48 }}>
                <ScanIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Scan QR Code</h3>
                <p className="text-sm text-muted-foreground">Point your camera at a QR code</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {!scanResult ? (
                <>
                  {/* Camera View */}
                  <div
                    id={scannerContainerId}
                    className="relative bg-[#1A1612] border-2 border-foreground overflow-hidden"
                    style={{ minHeight: 320 }}
                  >
                    {!isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <ScanIcon className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-sm">Camera preview will appear here</p>
                      </div>
                    )}
                  </div>

                  {scanError && (
                    <div className="error-box animate-shake">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="font-medium">{scanError}</span>
                    </div>
                  )}

                  <button
                    onClick={isScanning ? stopScanning : startScanning}
                    className={isScanning ? "btn-secondary w-full" : "btn-primary w-full"}
                  >
                    {isScanning ? (
                      <><LoaderIcon className="w-5 h-5" />Stop Camera</>
                    ) : (
                      <><ScanIcon className="w-5 h-5" />Start Camera</>
                    )}
                  </button>

                  <div className="info-box">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                    </svg>
                    <div className="text-sm">
                      <p className="font-bold text-foreground mb-1">Tips for scanning</p>
                      <p className="text-muted-foreground">
                        Hold your device steady and ensure good lighting. The QR code should be clearly visible within the frame.
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
                    onClick={() => { setScanResult(null); setScanError(null); }}
                    className="btn-secondary w-full"
                  >
                    Scan Another Code
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-12 border-t-2 border-foreground">
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="feature-item">
            <div className="feature-icon">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">100% Private</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              QR codes are generated locally. Your data never leaves your device.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">Instant</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate and scan in milliseconds. No waiting for servers.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon">
              <QRIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Multiple Formats</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Text, URLs, WiFi credentials, email, phone, and SMS supported.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

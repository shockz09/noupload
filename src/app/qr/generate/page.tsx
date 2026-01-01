"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
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
import { ArrowLeftIcon, DownloadIcon, LoaderIcon, CopyIcon } from "@/components/icons";
import { copyImageToClipboard } from "@/lib/image-utils";

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

export default function QRGeneratePage() {
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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    try {
      const data = getDataString();
      const dataUrl = await generateQRDataURL(data, { width: 400 });
      setQrImage(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR code");
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
      // Download failure is non-critical
    }
  };

  const handleCopy = async () => {
    if (!qrImage) return;
    try {
      const data = getDataString();
      const blob = await generateQRBlob(data, { width: 800 });
      await copyImageToClipboard(blob);
    } catch {
      // Copy failure is non-critical
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
        <div className="tool-icon tool-qr-generate" style={{ width: 64, height: 64 }}>
          <QRIcon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display">Generate QR Code</h1>
          <p className="text-muted-foreground mt-2">Create QR codes for text, URLs, WiFi, and more</p>
        </div>
      </div>

      <div className="border-2 border-foreground bg-card">
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

          {error && (
            <div className="error-box animate-shake">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-medium">{error}</span>
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
              <div className="flex gap-2">
                <button onClick={handleDownload} className="btn-success flex-1">
                  <DownloadIcon className="w-5 h-5" />Download PNG (High Resolution)
                </button>
                <button
                  onClick={handleCopy}
                  className="btn-success px-3"
                  title="Copy to clipboard"
                >
                  <CopyIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// QR Code utilities - all client-side

import QRCode from "qrcode";

export type QRDataType = "text" | "url" | "wifi" | "email" | "phone" | "sms";

export interface WifiData {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

export interface EmailData {
  to: string;
  subject?: string;
  body?: string;
}

export interface SmsData {
  phone: string;
  message?: string;
}

// Escape special characters for WiFi QR string
function escapeWifiString(str: string): string {
  return str
    .replace(/\\/g, "\\\\") // Backslash first
    .replace(/;/g, "\\;")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/"/g, '\\"');
}

// Generate WiFi QR string
export function generateWifiString(data: WifiData): string {
  const hidden = data.hidden ? "H:true" : "";
  return `WIFI:T:${data.encryption};S:${escapeWifiString(data.ssid)};P:${escapeWifiString(data.password)};${hidden};`;
}

// Generate Email QR string (mailto:)
export function generateEmailString(data: EmailData): string {
  let mailto = `mailto:${data.to}`;
  const params: string[] = [];
  if (data.subject) params.push(`subject=${encodeURIComponent(data.subject)}`);
  if (data.body) params.push(`body=${encodeURIComponent(data.body)}`);
  if (params.length > 0) mailto += `?${params.join("&")}`;
  return mailto;
}

// Generate SMS QR string
export function generateSmsString(data: SmsData): string {
  let sms = `sms:${data.phone}`;
  if (data.message) sms += `?body=${encodeURIComponent(data.message)}`;
  return sms;
}

// Generate Phone QR string
export function generatePhoneString(phone: string): string {
  return `tel:${phone}`;
}

// Generate QR code as data URL
export async function generateQRDataURL(
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
): Promise<string> {
  const opts = {
    width: options?.width || 400,
    margin: options?.margin ?? 2,
    color: {
      dark: options?.color?.dark || "#000000",
      light: options?.color?.light || "#FFFFFF",
    },
    errorCorrectionLevel: options?.errorCorrectionLevel || "M",
  };

  return QRCode.toDataURL(data, opts);
}

// Generate QR code as Blob for download
export async function generateQRBlob(
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
): Promise<Blob> {
  const dataUrl = await generateQRDataURL(data, options);
  const response = await fetch(dataUrl);
  return response.blob();
}

// Download QR code
export function downloadQR(blob: Blob, filename: string = "qrcode.png"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

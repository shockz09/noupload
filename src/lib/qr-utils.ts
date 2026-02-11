// QR Code utilities - all client-side

// Lazy load QRCode library (~232KB)
const getQRCode = async () => (await import("qrcode")).default;

export type QRDataType = "text" | "url" | "wifi" | "email" | "phone" | "sms" | "upi";

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

export interface UpiData {
  vpa: string; // UPI ID e.g. username@bankname
  amount?: string; // Optional fixed amount
  note?: string; // Transaction note
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

// Generate UPI QR string
export function generateUpiString(data: UpiData): string {
  const parts = [`pa=${encodeURIComponent(data.vpa)}`];
  if (data.amount) parts.push(`am=${encodeURIComponent(data.amount)}`);
  if (data.note) parts.push(`tn=${encodeURIComponent(data.note)}`);
  parts.push("cu=INR");
  return `upi://pay?${parts.join("&")}`;
}

// Generate QR code as data URL
export async function generateQRDataURL(
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  },
): Promise<string> {
  const QRCode = await getQRCode();
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
  },
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

// Helper to load image from URL
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Generate QR code with logo overlay
export async function generateQRWithLogo(
  data: string,
  logo: File,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    logoPadding?: boolean;
  },
): Promise<string> {
  // Use error correction "H" (30%) for logo tolerance
  const qrDataUrl = await generateQRDataURL(data, {
    ...options,
    errorCorrectionLevel: "H",
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Draw QR
  const qrImg = await loadImage(qrDataUrl);
  canvas.width = qrImg.width;
  canvas.height = qrImg.height;
  ctx.drawImage(qrImg, 0, 0);

  // Draw logo in center (22% of QR size)
  const logoUrl = URL.createObjectURL(logo);
  try {
    const logoImg = await loadImage(logoUrl);
    const size = qrImg.width * 0.22;
    const x = (qrImg.width - size) / 2;
    const y = (qrImg.height - size) / 2;

    if (options?.logoPadding) {
      ctx.fillStyle = options?.color?.light || "#FFFFFF";
      const pad = 8;
      ctx.fillRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
    }

    ctx.drawImage(logoImg, x, y, size, size);
  } finally {
    URL.revokeObjectURL(logoUrl);
  }

  return canvas.toDataURL("image/png");
}

// Generate QR with logo as Blob
export async function generateQRBlobWithLogo(
  data: string,
  logo: File,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    logoPadding?: boolean;
  },
): Promise<Blob> {
  const dataUrl = await generateQRWithLogo(data, logo, options);
  const response = await fetch(dataUrl);
  return response.blob();
}

// Color presets for QR customization
export const QR_COLOR_PRESETS = [
  { name: "Classic", dark: "#000000", light: "#FFFFFF" },
  { name: "Noir", dark: "#FFFFFF", light: "#1A1A1A" },
  { name: "Cherry", dark: "#FF1744", light: "#000000" },
  { name: "Sakura", dark: "#FF4081", light: "#0D0D0D" },
  { name: "Amber", dark: "#FFB300", light: "#1A1A1A" },
  { name: "Mint", dark: "#00E676", light: "#0A0A0A" },
  { name: "Electric", dark: "#536DFE", light: "#0D0D0D" },
  { name: "Lavender", dark: "#E040FB", light: "#0F0F0F" },
  { name: "Coral", dark: "#FF6D00", light: "#FFFFFF" },
  { name: "Navy", dark: "#1A237E", light: "#E8EAF6" },
];

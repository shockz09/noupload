export type BufferFileType = "pdf" | "image" | "video" | "audio" | "other";

export function matchesFileAccept(filename: string, mimeType: string, accept: string): boolean {
  const name = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  return accept.split(",").some((part) => {
    const token = part.trim().toLowerCase();
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return mime.startsWith(token.slice(0, -1));
    return token === mime;
  });
}

// Derives the dock category from a MIME type. Callers may pass fileType
// explicitly, but leaving it off keeps the category and the blob in sync.
export function inferFileType(mimeType: string): BufferFileType {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "other";
}

export interface BufferItem {
  id: string;
  filename: string;
  blob: Blob;
  mimeType: string;
  size: number;
  fileType: BufferFileType;
  sourceToolLabel: string;
  createdAt: number;
  previewUrl?: string;
}

export type AddBufferItemInput = Omit<BufferItem, "id" | "createdAt" | "previewUrl" | "fileType"> & {
  fileType?: BufferFileType;
};

export interface AddBufferResult {
  ok: boolean;
  error?: string;
}

// Maps MIME types to common file extensions for accept-string matching
export const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/bmp": [".bmp"],
  "image/tiff": [".tif", ".tiff"],
  "image/heic": [".heic"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/ogg": [".ogg"],
  "audio/flac": [".flac"],
  "audio/aac": [".aac"],
  "audio/mp4": [".m4a"],
};

/**
 * Download utilities for browser file operations
 * Centralizes all download patterns used across the app
 */

/**
 * Download a Blob or Uint8Array as a file
 */
export function downloadBlob(data: Blob | Uint8Array, filename: string, type = "application/pdf"): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download text content as a file
 */
export function downloadText(text: string, filename: string, type = "text/plain"): void {
  const blob = new Blob([text], { type });
  downloadBlob(blob, filename);
}

/**
 * Download a URL (data URL or object URL) as a file
 */
export function downloadFile(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Download multiple files as a single ZIP archive
 */
export async function downloadMultiple(
  items: Array<{ data: Blob | Uint8Array; filename: string }>,
  zipName = "files.zip",
): Promise<void> {
  const { zipSync } = await import("fflate");

  const files: Record<string, Uint8Array> = {};
  for (const { data, filename } of items) {
    if (data instanceof Blob) {
      files[filename] = new Uint8Array(await data.arrayBuffer());
    } else {
      files[filename] = data instanceof Uint8Array ? data : new Uint8Array(data);
    }
  }

  const zipped = zipSync(files);
  const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
  downloadBlob(blob, zipName);
}

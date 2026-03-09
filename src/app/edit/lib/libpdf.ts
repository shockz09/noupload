"use client";

let libpdfPromise: Promise<typeof import("@libpdf/core")> | null = null;

export function loadLibPdf() {
  if (!libpdfPromise) {
    libpdfPromise = import("@libpdf/core");
  }
  return libpdfPromise;
}

/// <reference lib="webworker" />

import type { GsCompressionPreset, GsWorkerMessage, GsWorkerResponse, PdfALevel } from "./types";

declare const self: DedicatedWorkerGlobalScope;

// Ghostscript module interface (Emscripten)
interface GsModule {
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string, opts?: { encoding: string }) => Uint8Array;
    unlink: (path: string) => void;
  };
  callMain: (args: string[]) => number;
}

// Package version for cache busting
const GS_VERSION = "0.1.0";
const CACHE_NAME = `ghostscript-wasm-${GS_VERSION}`;
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@bentopdf/gs-wasm@${GS_VERSION}/assets`;

let gsModule: GsModule | null = null;
let initPromise: Promise<void> | null = null;

// Cached fetch with Cache API
async function cachedFetch(url: string): Promise<Response> {
  if (typeof caches === "undefined") {
    return fetch(url);
  }

  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(url);

  if (!response) {
    response = await fetch(url);
    await cache.put(url, response.clone());
  }

  return response;
}

// Send progress update to main thread
function sendProgress(id: string, message: string): void {
  self.postMessage({ id, progress: message } as GsWorkerResponse);
}

// Initialize Ghostscript module
async function initGs(id: string): Promise<void> {
  if (gsModule) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      sendProgress(id, "Loading Ghostscript...");

      // Fetch gs.js from CDN
      const jsUrl = `${CDN_BASE}/gs.js`;
      const response = await cachedFetch(jsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch gs.js: ${response.status}`);
      }

      let scriptText = await response.text();

      // Patch the script for worker context:
      // 1. Replace import.meta.url with our CDN URL
      scriptText = scriptText.replace(/import\.meta\.url/g, `"${jsUrl}"`);

      // 2. Remove dynamic import of "module" (Node.js only)
      scriptText = scriptText.replace(
        /if\(l\)\{const\s*\{createRequire:a\}=await import\("module"\);var require=a\([^)]+\)\}/g,
        "if(l){}"
      );

      // 3. Remove export statements (exact match for minified code)
      scriptText = scriptText.replace(/export default Module;/g, "");
      scriptText = scriptText.replace(/export\s*\{[^}]*\}\s*;?/g, "");
      scriptText = scriptText.replace(/export\s+default\s+\w+\s*;?/g, "");

      // 4. Wrap in async IIFE and expose Module globally
      const wrappedScript = `
        (async function() {
          ${scriptText}
          self.GsModule = Module;
        })();
      `;

      // Execute via Blob URL (supports async/await unlike new Function)
      const blob = new Blob([wrappedScript], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);

      // Import as module
      await import(/* webpackIgnore: true */ blobUrl);
      URL.revokeObjectURL(blobUrl);

      // Get the Module factory from global scope
      const createModule = (self as unknown as { GsModule: (options?: Record<string, unknown>) => Promise<GsModule> }).GsModule;

      if (!createModule || typeof createModule !== "function") {
        throw new Error("Failed to load Ghostscript module");
      }

      sendProgress(id, "Initializing...");

      // Initialize module with WASM location
      gsModule = await createModule({
        locateFile: (filename: string) => `${CDN_BASE}/${filename}`,
        print: () => {
          // Ghostscript stdout - silenced
        },
        printErr: (text: string) => {
          console.error("[gs]", text);
        },
      });

      sendProgress(id, "Ready");
    } catch (error) {
      console.error("[gs worker] Init error:", error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

// Quality settings for each compression level
const QUALITY_SETTINGS: Record<GsCompressionPreset, {
  imageQuality: number;
  resolution: number;
}> = {
  printer: { imageQuality: 90, resolution: 200 },  // Light: ~30-50%
  ebook: { imageQuality: 70, resolution: 120 },    // Balanced: ~50-80%
  screen: { imageQuality: 40, resolution: 72 },    // Maximum: ~80-95%
  prepress: { imageQuality: 95, resolution: 300 }, // Unused but defined
};

// Execute Ghostscript with given arguments
async function executeGs(
  id: string,
  inputData: Uint8Array,
  args: string[],
  progressMessage: string,
): Promise<Uint8Array> {
  await initGs(id);

  if (!gsModule) {
    throw new Error("Ghostscript module not initialized");
  }

  sendProgress(id, progressMessage);

  // Write input file to virtual filesystem
  gsModule.FS.writeFile("/input.pdf", inputData);

  // Execute Ghostscript
  const exitCode = gsModule.callMain(args);

  if (exitCode !== 0) {
    throw new Error(`Ghostscript exited with code ${exitCode}`);
  }

  // Read output
  const result = gsModule.FS.readFile("/output.pdf", { encoding: "binary" });

  // Cleanup
  try {
    gsModule.FS.unlink("/input.pdf");
    gsModule.FS.unlink("/output.pdf");
  } catch {
    // Files may not exist
  }

  return new Uint8Array(result);
}

// Compress PDF
async function compressPdf(
  id: string,
  inputData: Uint8Array,
  preset: GsCompressionPreset,
): Promise<Uint8Array> {
  const settings = QUALITY_SETTINGS[preset];

  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    // Force image recompression
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    "-dMonoImageDownsampleType=/Bicubic",
    "-dDownsampleColorImages=true",
    "-dDownsampleGrayImages=true",
    "-dDownsampleMonoImages=true",
    // Set target resolution
    `-dColorImageResolution=${settings.resolution}`,
    `-dGrayImageResolution=${settings.resolution}`,
    `-dMonoImageResolution=${settings.resolution}`,
    // Set JPEG quality (lower = smaller file)
    `-dColorImageQuality=${settings.imageQuality}`,
    `-dGrayImageQuality=${settings.imageQuality}`,
    // Compress everything
    "-dCompressPages=true",
    "-dOptimize=true",
    "-sOutputFile=/output.pdf",
    "/input.pdf",
  ];

  return executeGs(id, inputData, args, "Compressing PDF...");
}

// Convert PDF to Grayscale
async function toGrayscale(
  id: string,
  inputData: Uint8Array,
): Promise<Uint8Array> {
  const args = [
    "-sDEVICE=pdfwrite",
    "-sColorConversionStrategy=Gray",
    "-dProcessColorModel=/DeviceGray",
    "-dCompatibilityLevel=1.4",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-sOutputFile=/output.pdf",
    "/input.pdf",
  ];

  return executeGs(id, inputData, args, "Converting to grayscale...");
}

// Convert PDF to PDF/A
async function toPdfA(
  id: string,
  inputData: Uint8Array,
  level: PdfALevel,
): Promise<Uint8Array> {
  const levelNum = level === "2b" ? 2 : level === "3b" ? 3 : 1;

  const args = [
    `-dPDFA=${levelNum}`,
    "-dNOOUTERSAVE",
    "-sProcessColorModel=DeviceRGB",
    "-sDEVICE=pdfwrite",
    "-dPDFACompatibilityPolicy=1",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-sOutputFile=/output.pdf",
    "/input.pdf",
  ];

  return executeGs(id, inputData, args, `Converting to PDF/A-${level}...`);
}

// Message handler
self.onmessage = async (event: MessageEvent<GsWorkerMessage>) => {
  const { id, operation, inputData, options } = event.data;

  try {
    let result: Uint8Array;

    switch (operation) {
      case "compress":
        result = await compressPdf(
          id,
          new Uint8Array(inputData),
          options?.preset ?? "ebook",
        );
        break;

      case "grayscale":
        result = await toGrayscale(id, new Uint8Array(inputData));
        break;

      case "pdfa":
        result = await toPdfA(
          id,
          new Uint8Array(inputData),
          options?.pdfaLevel ?? "1b",
        );
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    self.postMessage(
      {
        id,
        success: true,
        data: result,
      } as GsWorkerResponse,
      [result.buffer],
    );
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    } as GsWorkerResponse);
  }
};

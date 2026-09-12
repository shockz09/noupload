/// <reference lib="webworker" />

import type {
  CompressionLevel,
  CompressionPass,
  GsImageFormat,
  GsWorkerMessage,
  GsWorkerResponse,
  PdfALevel,
} from "./types";
import { COMPRESSION_LADDER, GOOD_ENOUGH_SAVINGS } from "./types";

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

/** Lines Ghostscript wrote to stderr during the current callMain. */
let gsErrorLog: string[] = [];

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
        "if(l){}",
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
      const createModule = (self as unknown as { GsModule: (options?: Record<string, unknown>) => Promise<GsModule> })
        .GsModule;

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
          // Kept so a run that "succeeds" with a broken file (encrypted input,
          // no pages rendered) can be spotted after the fact.
          gsErrorLog.push(text);
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

/**
 * Ghostscript exits 0 on some fatal inputs and writes a near-empty PDF instead.
 * The obvious one is a password-protected file: pdfwrite emits a valid-looking
 * ~2KB document with zero pages, which would otherwise be reported to the user
 * as a 99% saving on a file that no longer contains their document.
 */
function assertUsableRun(): void {
  const log = gsErrorLog.join("\n");

  if (/requires a password|Password did not work/i.test(log)) {
    throw new Error("PASSWORD_PROTECTED");
  }
  if (/No pages will be processed/i.test(log)) {
    throw new Error("NO_PAGES");
  }
}

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
  gsErrorLog = [];
  const exitCode = gsModule.callMain(args);

  if (exitCode !== 0) {
    assertUsableRun();
    throw new Error(`Ghostscript exited with code ${exitCode}`);
  }

  assertUsableRun();

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

/**
 * pdfwrite arguments for one compression pass.
 *
 * Two things matter more than the rest here:
 * - the downsample threshold. Ghostscript's default of 1.5 skips downsampling
 *   unless an image is already 1.5x the target DPI, so a 150 DPI scan aimed at
 *   120 DPI came out untouched — and then bigger, because everything else got
 *   rewritten. 1.0 downsamples whenever there is anything to shave.
 * - the QFactor dictionaries. `-dColorImageQuality` is not a pdfwrite parameter
 *   at all (it was silently ignored), so JPEG quality never actually changed
 *   between "light" and "maximum". QFactor is the real knob, and it only reaches
 *   pdfwrite through setdistillerparams.
 */
function compressArgs(pass: CompressionPass, imageFormat: GsImageFormat): string[] {
  const dict = `<</QFactor ${pass.qFactor} /Blend 1 /HSamples [2 1 1 2] /VSamples [2 1 1 2]>>`;
  const photoFilter = imageFormat === "flate" ? "/FlateEncode" : "/DCTEncode";

  return [
    "-sDEVICE=pdfwrite",
    // 1.5+ so pdfwrite can pack objects into compressed object/xref streams. At
    // 1.4 the plain cross-reference table alone can make the output bigger than
    // the input on PDFs with little image data to shave off.
    "-dCompatibilityLevel=1.5",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    // Downsample images to the target resolution
    "-dDownsampleColorImages=true",
    "-dDownsampleGrayImages=true",
    "-dDownsampleMonoImages=true",
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    // Bicubic on 1-bit scans smears the text; subsampling keeps strokes crisp.
    "-dMonoImageDownsampleType=/Subsample",
    `-dColorImageResolution=${pass.resolution}`,
    `-dGrayImageResolution=${pass.resolution}`,
    `-dMonoImageResolution=${pass.monoResolution}`,
    "-dColorImageDownsampleThreshold=1.0",
    "-dGrayImageDownsampleThreshold=1.0",
    "-dMonoImageDownsampleThreshold=1.0",
    // Always re-encode photos as JPEG instead of letting the auto filter fall
    // back to Flate, which balloons scanned pages.
    "-dAutoFilterColorImages=false",
    "-dAutoFilterGrayImages=false",
    "-dEncodeColorImages=true",
    "-dEncodeGrayImages=true",
    "-dEncodeMonoImages=true",
    `-dColorImageFilter=${photoFilter}`,
    `-dGrayImageFilter=${photoFilter}`,
    "-dMonoImageFilter=/CCITTFaxEncode",
    // Structural savings
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    "-dCompressPages=true",
    "-dOptimize=true",
    "-dFastWebView=false",
    "-sOutputFile=/output.pdf",
    // -c must follow -sOutputFile (the device is opened when -c runs) and the
    // input must come after -f. With Flate images there is no JPEG quality to
    // set, so the distiller dictionaries are pointless.
    ...(imageFormat === "flate"
      ? []
      : [
          "-c",
          `<</ColorACSImageDict ${dict} /ColorImageDict ${dict} /GrayACSImageDict ${dict} /GrayImageDict ${dict}>> setdistillerparams`,
        ]),
    "-f",
    "/input.pdf",
  ];
}

/**
 * Runs the level's passes until one saves enough, keeping the smallest output.
 *
 * A single pass is all most files need. The extra pass is for PDFs where the
 * first one barely helps: rather than handing back "this is already as small as
 * it gets", try harder within the level the user picked.
 */
async function compressPdf(
  id: string,
  inputData: Uint8Array,
  level: CompressionLevel,
  imageFormat: GsImageFormat,
): Promise<Uint8Array> {
  const passes = COMPRESSION_LADDER[level];
  const target = GOOD_ENOUGH_SAVINGS[level];
  const originalSize = inputData.length;

  // Flate output is an intermediate on the way to our own JPEG encoder, so the
  // "is it small enough yet" ladder does not apply — it is meant to stay big.
  if (imageFormat === "flate") {
    return executeGs(id, new Uint8Array(inputData), compressArgs(passes[0], "flate"), "Preparing images...");
  }

  let best: Uint8Array | null = null;

  for (let i = 0; i < passes.length; i++) {
    const label = i === 0 ? "Compressing PDF..." : "Squeezing harder...";
    // executeGs consumes the input file each run, so hand it a fresh copy.
    const output = await executeGs(id, new Uint8Array(inputData), compressArgs(passes[i], "jpeg"), label);

    if (!best || output.length < best.length) best = output;

    const savings = 1 - best.length / originalSize;
    if (savings >= target) break;
  }

  if (!best) throw new Error("Compression produced no output");
  return best;
}

// Convert PDF to Grayscale
async function toGrayscale(id: string, inputData: Uint8Array): Promise<Uint8Array> {
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
async function toPdfA(id: string, inputData: Uint8Array, level: PdfALevel): Promise<Uint8Array> {
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
          options?.level ?? "balanced",
          options?.imageFormat ?? "jpeg",
        );
        break;

      case "grayscale":
        result = await toGrayscale(id, new Uint8Array(inputData));
        break;

      case "pdfa":
        result = await toPdfA(id, new Uint8Array(inputData), options?.pdfaLevel ?? "1b");
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

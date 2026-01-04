/// <reference lib="webworker" />

import type { GsCompressionPreset, GsWorkerMessage, GsWorkerResponse } from "./types";

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
      sendProgress(id, "Downloading compression engine...");

      // Fetch gs.js from CDN
      const jsUrl = `${CDN_BASE}/gs.js`;
      const response = await cachedFetch(jsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch gs.js: ${response.status}`);
      }

      let scriptText = await response.text();

      // Fix the script for worker context
      // Remove ES module export if present
      scriptText = scriptText.replace(/export\s+default\s+\w+\s*;?/g, "");

      // Fix _scriptName for worker context
      scriptText = scriptText.replace(
        /var\s+_scriptName\s*=\s*typeof\s+document[^;]*;/,
        `var _scriptName = "${jsUrl}";`,
      );

      // Create function that returns the Module factory
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const getModule = new Function(`${scriptText}; return Module;`);
      const createModule = getModule() as (
        options?: Record<string, unknown>,
      ) => Promise<GsModule>;

      if (!createModule || typeof createModule !== "function") {
        throw new Error("Failed to load Ghostscript module");
      }

      sendProgress(id, "Initializing compression engine...");

      // Initialize module with WASM location
      gsModule = await createModule({
        locateFile: (filename: string) => `${CDN_BASE}/${filename}`,
        print: (text: string) => {
          console.log("[gs]", text);
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

// Compress PDF with Ghostscript
async function compressPdf(
  id: string,
  inputData: Uint8Array,
  preset: GsCompressionPreset,
): Promise<Uint8Array> {
  await initGs(id);

  if (!gsModule) {
    throw new Error("Ghostscript module not initialized");
  }

  sendProgress(id, "Compressing PDF...");

  // Write input file to virtual filesystem
  gsModule.FS.writeFile("/input.pdf", inputData);

  // Build Ghostscript command
  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=/${preset}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-sOutputFile=/output.pdf",
    "/input.pdf",
  ];

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

// Message handler
self.onmessage = async (event: MessageEvent<GsWorkerMessage>) => {
  const { id, inputData, preset } = event.data;

  try {
    const result = await compressPdf(id, new Uint8Array(inputData), preset);

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

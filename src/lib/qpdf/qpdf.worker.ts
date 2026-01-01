/// <reference lib="webworker" />

import type { QpdfWorkerMessage, QpdfWorkerResponse, QpdfEncryptOptions } from './types';
import { INPUT_PATH, OUTPUT_PATH } from './constants';

interface QpdfModule {
  FS: {
    mkdir: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  callMain: (args: string[]) => number;
}

declare const self: DedicatedWorkerGlobalScope;

let qpdfModule: QpdfModule | null = null;
let initPromise: Promise<void> | null = null;

// Load from public folder to avoid cross-origin issues
// Workers need absolute URLs
const QPDF_BASE = `${self.location.origin}/wasm`;
const QPDF_JS_URL = `${QPDF_BASE}/qpdf.js`;
const CACHE_NAME = 'qpdf-wasm-v1';

// Cached fetch - persists across browser sessions
async function cachedFetch(url: string): Promise<Response> {
  if (typeof caches === 'undefined') {
    return fetch(url);
  }

  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(url);

  if (!response) {
    console.log('[qpdf worker] Cache miss, fetching:', url);
    response = await fetch(url);
    await cache.put(url, response.clone());
  } else {
    console.log('[qpdf worker] Cache hit:', url);
  }

  return response;
}

// Initialize WASM module (singleton pattern)
async function initQpdf(): Promise<void> {
  if (qpdfModule) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Fetch the script from cache or public folder
      const response = await cachedFetch(QPDF_JS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch qpdf.js: ${response.status}`);
      }
      let scriptText = await response.text();

      // Remove the ES module export statement since we're using eval
      // The script ends with: export default init;
      scriptText = scriptText.replace(/export\s+default\s+init\s*;?/g, '');

      // Also remove any pthread-related code at the end
      scriptText = scriptText.replace(/var isPthread[\s\S]*$/, '');

      // Fix the _scriptName to point to our local copy
      // The original tries to get it from document.currentScript which is undefined in our context
      scriptText = scriptText.replace(
        /var _scriptName\s*=\s*typeof document[^;]*;/,
        `var _scriptName = "${QPDF_JS_URL}";`
      );

      // Create a function that executes the script and returns init
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const getInit = new Function(`${scriptText}; return init;`);
      const createModule = getInit() as (options?: Record<string, unknown>) => Promise<QpdfModule>;

      if (!createModule || typeof createModule !== 'function') {
        throw new Error('Failed to load qpdf module - init function not found');
      }

      // Configure the module with proper file locations
      qpdfModule = await createModule({
        locateFile: (filename: string) => `${QPDF_BASE}/${filename}`,
        mainScriptUrlOrBlob: QPDF_JS_URL,
      });

      // Create virtual filesystem directories
      try {
        qpdfModule!.FS.mkdir('/input');
      } catch {
        // Directory may exist
      }
      try {
        qpdfModule!.FS.mkdir('/output');
      } catch {
        // Directory may exist
      }

      console.log('[qpdf worker] Module initialized successfully');
    } catch (error) {
      console.error('[qpdf worker] Init error:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

// Clean up virtual filesystem
function cleanup(): void {
  if (!qpdfModule) return;

  try {
    qpdfModule.FS.unlink(INPUT_PATH);
  } catch {
    // File may not exist
  }

  try {
    qpdfModule.FS.unlink(OUTPUT_PATH);
  } catch {
    // File may not exist
  }
}

// Build encryption arguments
function buildEncryptArgs(options: QpdfEncryptOptions): string[] {
  const args = [
    '--encrypt',
    options.userPassword || '',
    options.ownerPassword,
    options.keyLength.toString(),
  ];

  // Add permission restrictions if specified
  if (options.permissions) {
    if (options.permissions.print === false) args.push('--print=none');
    if (options.permissions.modify === false) args.push('--modify=none');
    if (options.permissions.copy === false) args.push('--extract=n');
    if (options.permissions.annotate === false) args.push('--annotate=n');
  }

  args.push('--'); // End of encryption options
  return args;
}

// Execute qpdf operation
async function executeOperation(message: QpdfWorkerMessage): Promise<QpdfWorkerResponse> {
  const { id, operation, inputData, options } = message;

  try {
    await initQpdf();

    if (!qpdfModule) {
      return {
        id,
        success: false,
        error: 'Failed to initialize qpdf module',
        errorCode: 'UNKNOWN',
      };
    }

    // Write input file
    qpdfModule.FS.writeFile(INPUT_PATH, inputData);

    // Build command arguments based on operation
    let args: string[] = [];
    let needsOutput = true;

    switch (operation) {
      case 'encrypt': {
        const encryptOpts = options as QpdfEncryptOptions;
        args = [...buildEncryptArgs(encryptOpts), INPUT_PATH, OUTPUT_PATH];
        break;
      }

      case 'decrypt': {
        const decryptOpts = options as { password: string };
        args = [
          `--password=${decryptOpts.password}`,
          '--decrypt',
          INPUT_PATH,
          OUTPUT_PATH,
        ];
        break;
      }

      case 'repair':
        args = [INPUT_PATH, '--qdf', OUTPUT_PATH];
        break;

      case 'linearize':
        args = [INPUT_PATH, '--linearize', OUTPUT_PATH];
        break;

      case 'check':
        args = ['--check', INPUT_PATH];
        needsOutput = false;
        break;

      default:
        return {
          id,
          success: false,
          error: `Unknown operation: ${operation}`,
          errorCode: 'UNKNOWN',
        };
    }

    // Execute qpdf
    let exitCode: number;
    try {
      exitCode = qpdfModule.callMain(args);
    } catch (error) {
      // qpdf throws on some errors
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.toLowerCase().includes('password')) {
        return {
          id,
          success: false,
          error: 'Incorrect password',
          errorCode: 'WRONG_PASSWORD',
        };
      }

      return {
        id,
        success: false,
        error: errorMsg,
        errorCode: 'UNKNOWN',
      };
    }

    // Check for errors
    if (exitCode !== 0 && operation !== 'check') {
      // Exit code 2 typically means wrong password
      if (exitCode === 2) {
        return {
          id,
          success: false,
          error: 'Wrong password or corrupted file',
          errorCode: 'WRONG_PASSWORD',
        };
      }
      return {
        id,
        success: false,
        error: `qpdf exited with code ${exitCode}`,
        errorCode: 'UNKNOWN',
      };
    }

    // Read output (if applicable)
    let outputData: Uint8Array | undefined;
    if (needsOutput) {
      try {
        outputData = qpdfModule.FS.readFile(OUTPUT_PATH);
      } catch {
        return {
          id,
          success: false,
          error: 'Failed to read output file',
          errorCode: 'UNKNOWN',
        };
      }
    }

    return {
      id,
      success: true,
      data: outputData,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[qpdf worker] Operation error:', error);

    // Parse qpdf-specific errors
    if (errorMessage.toLowerCase().includes('password')) {
      return { id, success: false, error: 'Incorrect password', errorCode: 'WRONG_PASSWORD' };
    }
    if (errorMessage.includes('damaged') || errorMessage.includes('invalid')) {
      return { id, success: false, error: 'Corrupted PDF file', errorCode: 'CORRUPTED_FILE' };
    }

    return { id, success: false, error: errorMessage, errorCode: 'UNKNOWN' };

  } finally {
    cleanup();
  }
}

// Message handler
self.onmessage = async (event: MessageEvent<QpdfWorkerMessage>) => {
  const response = await executeOperation(event.data);
  self.postMessage(response);
};

// Export for TypeScript
export {};

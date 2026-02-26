/**
 * Singleton wrapper around ZetaJS (LibreOffice WASM) for document-to-PDF conversion.
 *
 * Architecture:
 *   Main thread: loads Emscripten (soffice.js) via ZetaHelperMain, manages VFS
 *   Worker thread: runs LibreOffice UNO API via ZetaHelperThread
 *   Communication: MessagePort between main & worker, files via Emscripten FS
 */

export type ConverterStatus = "idle" | "loading" | "ready" | "converting" | "error";

type StatusListener = (status: ConverterStatus) => void;

interface ZetaHelperMainInstance {
  thrPort: MessagePort;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  start: (callback: () => void) => void;
}

let instance: LibreOfficeConverter | null = null;

class LibreOfficeConverter {
  private zHM: ZetaHelperMainInstance | null = null;
  private _status: ConverterStatus = "idle";
  private listeners: Set<StatusListener> = new Set();
  private initPromise: Promise<void> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private convertLock: Promise<unknown> = Promise.resolve();

  get status(): ConverterStatus {
    return this._status;
  }

  get isReady(): boolean {
    return this._status === "ready";
  }

  private setStatus(status: ConverterStatus) {
    this._status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async init(): Promise<void> {
    if (this._status === "ready") return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    this.setStatus("loading");

    try {
      // ZetaHelperMain requires a <canvas id="qtcanvas"> in the DOM
      if (!document.getElementById("qtcanvas")) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "qtcanvas";
        this.canvas.style.display = "none";
        document.body.appendChild(this.canvas);
      }

      // Dynamic import bypassing webpack — runtime-only vendor file from public/
      const helperUrl = "/vendor/zetajs/zetaHelper.js";
      const mod: { ZetaHelperMain: new (...args: unknown[]) => ZetaHelperMainInstance } = await (Function(
        "u",
        "return import(u)",
      )(helperUrl) as Promise<typeof mod>);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("LibreOffice WASM initialization timed out (120s)"));
        }, 120_000);

        const zHM = new mod.ZetaHelperMain("/workers/libreoffice-thread.js", {
          threadJsType: "module",
          wasmPkg: "free",
        });

        zHM.start(() => {
          clearTimeout(timeout);

          // Wait for the worker to signal 'start' (ready)
          zHM.thrPort.onmessage = (e: MessageEvent) => {
            if (e.data.cmd === "start") {
              this.zHM = zHM;
              this.setStatus("ready");
              resolve();
            }
          };
        });
      });
    } catch (err) {
      this.setStatus("error");
      this.initPromise = null;
      throw err;
    }
  }

  async convert(file: File): Promise<{ blob: Blob; processingTimeSeconds: number }> {
    if (!this.zHM) {
      throw new Error("Converter not initialized. Call init() first.");
    }

    // Serialize conversions to prevent onmessage handler clobbering
    const pending = this.convertLock;
    let release: () => void;
    this.convertLock = new Promise<void>((r) => {
      release = r;
    });

    await pending;

    const prevStatus = this._status;
    this.setStatus("converting");
    const startTime = performance.now();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Determine input path with correct extension for type detection
      const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : ".pptx";
      const inputPath = `/tmp/input${ext}`;
      const outputPath = "/tmp/output.pdf";

      // Write input file to Emscripten VFS
      this.zHM.FS.writeFile(inputPath, data);

      // Send convert command and wait for result
      const result = await new Promise<Uint8Array>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Conversion timed out (60s)"));
        }, 60_000);

        this.zHM!.thrPort.onmessage = (e: MessageEvent) => {
          clearTimeout(timeout);

          if (e.data.cmd === "converted") {
            try {
              const pdfData = this.zHM!.FS.readFile(e.data.to);
              resolve(pdfData);
            } catch {
              reject(new Error("Failed to read converted PDF"));
            } finally {
              // Cleanup VFS
              try {
                this.zHM!.FS.unlink(e.data.from);
              } catch {}
              try {
                this.zHM!.FS.unlink(e.data.to);
              } catch {}
            }
          } else if (e.data.cmd === "error") {
            reject(new Error(e.data.message || "Conversion failed"));
            try {
              this.zHM!.FS.unlink(inputPath);
            } catch {}
          }
        };

        this.zHM!.thrPort.postMessage({
          cmd: "convert",
          name: file.name.replace(/\.[^.]+$/, ""),
          from: inputPath,
          to: outputPath,
        });
      });

      const processingTimeSeconds = (performance.now() - startTime) / 1000;
      const blob = new Blob([new Uint8Array(result)], { type: "application/pdf" });

      return { blob, processingTimeSeconds };
    } finally {
      this.setStatus(prevStatus === "converting" ? "ready" : prevStatus);
      release!();
    }
  }

  destroy() {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.zHM = null;
    this.listeners.clear();
    this.initPromise = null;
    this.setStatus("idle");
    instance = null;
  }
}

export function getConverter(): LibreOfficeConverter {
  if (!instance) {
    instance = new LibreOfficeConverter();
  }
  return instance;
}

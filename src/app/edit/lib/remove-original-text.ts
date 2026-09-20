export interface TextRemovalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Reply {
  id: number;
  bytes?: Uint8Array;
  error?: string;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const instance = new Worker(new URL("./remove-original-text.worker.ts", import.meta.url), { type: "module" });
  instance.onmessage = ({ data }: MessageEvent<Reply>) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else if (data.bytes) request.resolve(data.bytes);
    else request.reject(new Error("PDF text removal returned no data."));
  };
  const failWorker = () => {
    for (const request of pending.values()) request.reject(new Error("PDF text removal worker failed."));
    pending.clear();
    instance.terminate();
    if (worker === instance) worker = null;
  };
  instance.onerror = failWorker;
  instance.onmessageerror = failWorker;
  worker = instance;
  return instance;
}

/** Remove native glyphs without blocking the editor's main thread. */
export async function removeOriginalText(
  bytes: Uint8Array,
  rectanglesByPage: Map<number, TextRemovalRect[]>,
): Promise<Uint8Array> {
  if (rectanglesByPage.size === 0) return bytes;
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, bytes, rectangles: Array.from(rectanglesByPage) }, [bytes.buffer]);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

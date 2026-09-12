/**
 * Getting the speech model onto the device, once.
 *
 * The weights are ~240 MB, which is a real download but a one-time one: every
 * byte goes into the Cache API on the way past, so the second visit — and
 * every visit after it — starts from disk with no network at all. Nothing about
 * the user's media is involved; this fetches public model files and nothing
 * else leaves the browser, ever.
 *
 * Runs inside the caption worker. `caches` is available there.
 */

/** Bump when the weights change, so old blobs are not served to new code. */
const CACHE_NAME = "noupload-parakeet-110m-fp16-v1";

const REPO = "shockz1/parakeet-tdt_ctc-110m-fp16-onnx";
const BASE = `https://huggingface.co/${REPO}/resolve/main`;

/**
 * Sizes are baked in so the progress bar is honest from the first byte:
 * HuggingFace answers the weight requests with a redirect to its CDN, and
 * `content-length` on the pre-redirect response describes the redirect, not
 * the file. These are the exact byte counts of the files in the repo.
 */
export const MODEL_FILES = [
  { key: "encoder", url: `${BASE}/encoder-model.fp16.onnx`, bytes: 228_563_328 },
  { key: "decoder", url: `${BASE}/decoder_joint-model.fp16.onnx`, bytes: 10_679_587 },
  { key: "tokenizer", url: `${BASE}/vocab.txt`, bytes: 9_953 },
] as const;

export const MODEL_TOTAL_BYTES = MODEL_FILES.reduce((sum, f) => sum + f.bytes, 0);

export interface ModelSources {
  encoderUrl: string;
  decoderUrl: string;
  tokenizerUrl: string;
  /** True when every file was served from disk — i.e. nothing was downloaded. */
  fromCache: boolean;
}

type ByteListener = (bytesReady: number) => void;

async function openCache(): Promise<Cache | null> {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    // Private windows and blocked site data land here. The model can still be
    // loaded straight from the network; it just will not be kept.
    return null;
  }
}

/** How much of the model is already on disk, in bytes. */
export async function cachedBytes(): Promise<number> {
  const cache = await openCache();
  if (!cache) return 0;
  let bytes = 0;
  await Promise.all(
    MODEL_FILES.map(async (file) => {
      if (await cache.match(file.url, { ignoreSearch: true })) bytes += file.bytes;
    }),
  );
  return bytes;
}

/** Forget the downloaded weights. The next run downloads them again. */
export async function clearModelCache(): Promise<void> {
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // Nothing to clean up if the cache was never reachable.
  }
}

/**
 * Ensure every model file is on disk, then hand back URLs to load them from.
 *
 * The download is streamed through a counting transform straight into the
 * cache, so progress is real byte progress and the 229 MB encoder never sits
 * in the JS heap on its way there. The URLs returned are `blob:` URLs backed by
 * the cached response, which keeps the runtime's own fetch off the network
 * entirely on later runs.
 */
export async function ensureModel(onBytes: ByteListener): Promise<ModelSources> {
  // Ask the browser not to evict a quarter-gigabyte the user just waited for.
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort; a refusal only means eviction stays possible.
  }

  const cache = await openCache();
  const urls: Record<string, string> = {};
  let ready = 0;
  let downloadedAnything = false;

  for (const file of MODEL_FILES) {
    const hit = cache ? await cache.match(file.url, { ignoreSearch: true }) : undefined;
    if (hit) {
      ready += file.bytes;
      onBytes(ready);
      urls[file.key] = URL.createObjectURL(await hit.blob());
      continue;
    }

    downloadedAnything = true;
    const response = await fetch(file.url);
    if (!response.ok || !response.body) {
      throw new Error(`Could not download the speech model (${response.status}).`);
    }

    const base = ready;
    let seen = 0;
    const counted = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          seen += chunk.byteLength;
          onBytes(base + Math.min(seen, file.bytes));
          controller.enqueue(chunk);
        },
      }),
    );

    const streamed = new Response(counted, { headers: response.headers });

    if (cache) {
      try {
        // Written first, then read back: teeing the stream to keep a copy in
        // hand would buffer the whole 229 MB encoder in memory while the cache
        // write drains. Going through disk costs a moment and no heap.
        await cache.put(file.url, streamed);
        const stored = await cache.match(file.url, { ignoreSearch: true });
        if (!stored) throw new Error("cache write vanished");
        urls[file.key] = URL.createObjectURL(await stored.blob());
      } catch {
        // Out of quota, or storage blocked. The runtime can still fetch the
        // file itself — this run works, it just will not be kept for the next.
        urls[file.key] = file.url;
      }
    } else {
      urls[file.key] = URL.createObjectURL(await streamed.blob());
    }

    ready = base + file.bytes;
    onBytes(ready);
  }

  return {
    encoderUrl: urls.encoder,
    decoderUrl: urls.decoder,
    tokenizerUrl: urls.tokenizer,
    fromCache: !downloadedAnything,
  };
}

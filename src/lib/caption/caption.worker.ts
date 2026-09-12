/// <reference lib="webworker" />
/**
 * Speech recognition, off the main thread.
 *
 * Everything expensive lives here: the 240 MB model download, the ONNX session
 * compile, and the inference itself. The page keeps a video playing and a list
 * editable while this runs flat out, which is the whole reason for the worker.
 *
 * Audio arrives already decoded to 16 kHz mono PCM — the page does that with
 * the browser's own decoder, which is faster than anything we could ship, and
 * hands the buffer over with a transfer, so no copy is made.
 */

import { ParakeetModel } from "parakeet.js";
import type { TimedWord } from "./cues";
import { ensureModel, MODEL_TOTAL_BYTES } from "./model";
import type { CaptionFailure, CaptionRequest, CaptionResponse } from "./protocol";

/** Window of audio handed to the model at once. */
const WINDOW_S = 90;
/** Lead-in replayed at the start of each window so the first words land right. */
const OVERLAP_S = 2;
/**
 * Peak amplitude below which a window is treated as silence and skipped.
 * ~-46 dBFS: quiet speech still clears this comfortably, room tone does not.
 */
const SILENCE_PEAK = 0.005;
/** Buckets in the waveform sent back for the audio player. */
const WAVEFORM_BUCKETS = 120;

const post = (message: CaptionResponse, transfer?: Transferable[]) =>
  transfer ? self.postMessage(message, transfer) : self.postMessage(message);

let modelPromise: Promise<ParakeetModel> | null = null;
/**
 * Which run is current. A run checks this between windows and stops the moment
 * it is no longer the newest — a flag would not do, because a superseded run
 * resumes from its `await` after the next one has already cleared it.
 */
let generation = 0;

/**
 * Load once per worker, and keep it.
 *
 * The promise is the cache: concurrent callers await the same load, and the
 * compiled sessions stay resident so a second file starts transcribing on the
 * next frame rather than after another compile.
 */
function loadModel(): Promise<ParakeetModel> {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    if (!("gpu" in navigator)) throw new WorkerError("no-webgpu");
    const started = performance.now();

    let sources: Awaited<ReturnType<typeof ensureModel>>;
    try {
      sources = await ensureModel((bytesReady) => {
        post({ type: "fetching", bytesReady, bytesTotal: MODEL_TOTAL_BYTES });
      });
    } catch (error) {
      throw new WorkerError("model", describe(error));
    }

    post({ type: "compiling" });

    let model: ParakeetModel;
    try {
      model = await ParakeetModel.fromUrls({
        encoderUrl: sources.encoderUrl,
        decoderUrl: sources.decoderUrl,
        tokenizerUrl: sources.tokenizerUrl,
        // Encoder on the GPU, decoder on WASM: the decoder is a tiny recurrent
        // step run thousands of times, and the round trip costs more than it saves.
        backend: "webgpu-hybrid",
        // The 110M model was trained on 80 mel bins; the 0.6B ones use 128,
        // which is what the library assumes when this is left out.
        nMels: 80,
      });
    } catch (error) {
      throw new WorkerError("model", describe(error));
    } finally {
      // The weights now live in the runtime. Let the browser drop the blobs.
      for (const url of [sources.encoderUrl, sources.decoderUrl, sources.tokenizerUrl]) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
    }

    adoptPredictionShape(model);
    post({ type: "ready", fromCache: sources.fromCache, ms: Math.round(performance.now() - started) });
    return model;
  })();

  // A failed load must not be remembered, or every later attempt replays the
  // same error without retrying.
  modelPromise.catch(() => {
    modelPromise = null;
  });

  return modelPromise;
}

/**
 * Match the decoder's zero state to the model actually loaded.
 *
 * parakeet.js sizes the prediction network for the 0.6B models (2 layers). The
 * 110M has 1, so its initial state would be twice the size the joint network
 * expects. The real shape is written on the session's own input metadata.
 */
function adoptPredictionShape(model: ParakeetModel): void {
  const runtime = model as unknown as {
    joinerSession?: { inputMetadata?: { name: string; shape: unknown[] }[] };
    predLayers: number;
    predHidden: number;
    ort: { Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown };
    _combState1: unknown;
    _combState2: unknown;
  };

  const meta = runtime.joinerSession?.inputMetadata?.find((input) => input.name === "input_states_1");
  if (!meta) return;

  const [layers, , hidden] = meta.shape;
  if (typeof layers !== "number" || typeof hidden !== "number") return;
  if (layers === runtime.predLayers && hidden === runtime.predHidden) return;

  runtime.predLayers = layers;
  runtime.predHidden = hidden;
  const zeros = new Float32Array(layers * hidden);
  runtime._combState1 = new runtime.ort.Tensor("float32", zeros, [layers, 1, hidden]);
  runtime._combState2 = new runtime.ort.Tensor("float32", zeros.slice(), [layers, 1, hidden]);
}

/** True when the window holds nothing louder than room tone. */
function isSilent(window: Float32Array): boolean {
  // Every 8th sample is plenty to spot speech at 16 kHz and costs an eighth as much.
  for (let i = 0; i < window.length; i += 8) {
    if (Math.abs(window[i]) > SILENCE_PEAK) return false;
  }
  return true;
}

/**
 * Loudness envelope, one peak per bucket.
 *
 * The page needs a waveform to draw and the samples are already here, so it
 * costs one pass instead of decoding the file a second time on the main thread
 * — which for an hour-long recording is a few hundred megabytes of work that
 * would otherwise happen while the user waits.
 */
function envelope(pcm: Float32Array, buckets = WAVEFORM_BUCKETS): number[] {
  const width = Math.max(1, Math.floor(pcm.length / buckets));
  const peaks: number[] = [];
  let loudest = 0;

  for (let b = 0; b < buckets; b++) {
    const from = b * width;
    const to = Math.min(pcm.length, from + width);
    let peak = 0;
    // Every 16th sample: a peak envelope does not need every one of them.
    for (let i = from; i < to; i += 16) {
      const level = Math.abs(pcm[i]);
      if (level > peak) peak = level;
    }
    if (peak > loudest) loudest = peak;
    peaks.push(peak);
  }

  // Normalised, so a quietly recorded file still fills the player.
  return loudest > 0 ? peaks.map((peak) => peak / loudest) : peaks;
}

async function transcribe(pcm: Float32Array, sampleRate: number, runId: number): Promise<void> {
  const mine = ++generation;
  post({ type: "waveform", runId, peaks: envelope(pcm) });
  const model = await loadModel();
  const duration = pcm.length / sampleRate;
  const started = performance.now();
  const words: TimedWord[] = [];

  for (let from = 0; from < duration - 0.05; from += WINDOW_S - OVERLAP_S) {
    if (mine !== generation) return;
    const to = Math.min(duration, from + WINDOW_S);
    const window = pcm.subarray(Math.floor(from * sampleRate), Math.floor(to * sampleRate));

    if (!isSilent(window)) {
      let result: Awaited<ReturnType<ParakeetModel["transcribe"]>>;
      try {
        result = await model.transcribe(window, sampleRate, {
          returnTimestamps: true,
          timeOffset: from,
        });
      } catch (error) {
        throw new WorkerError("transcribe", describe(error));
      }
      if (mine !== generation) return;

      // Windows overlap, so the lead-in comes back a second time. Keep only
      // what starts after everything already accepted.
      const lastEnd = words.length > 0 ? words[words.length - 1].end : Number.NEGATIVE_INFINITY;
      for (const word of result.words ?? []) {
        if (word.start_time >= lastEnd - 0.05) {
          words.push({ text: word.text, start: word.start_time, end: word.end_time });
        }
      }
    }

    // Send the whole list rather than a delta: it is a few kilobytes, and it
    // means a dropped or reordered message can never leave a gap in the page.
    post({ type: "words", runId, words: words.slice(), secondsDone: to });
  }

  post({ type: "done", runId, ms: Math.round(performance.now() - started) });
}

self.onmessage = async (event: MessageEvent<CaptionRequest>) => {
  const request = event.data;

  if (request.type === "cancel") {
    generation++;
    return;
  }

  if (request.type === "load") {
    // Warm the model up before a file is even chosen. Failures are reported
    // once here; the page decides whether to say anything about them yet.
    try {
      await loadModel();
    } catch (error) {
      report(error);
    }
    return;
  }

  if (request.type === "transcribe") {
    try {
      await transcribe(request.pcm, request.sampleRate, request.runId);
    } catch (error) {
      report(error);
    }
  }
};

// ------------------------------------------------------------------- errors

class WorkerError extends Error {
  constructor(
    readonly reason: CaptionFailure,
    detail?: string,
  ) {
    super(detail ?? reason);
  }
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

function report(error: unknown): void {
  if (error instanceof WorkerError) {
    post({ type: "failed", reason: error.reason, detail: error.message });
    return;
  }
  post({ type: "failed", reason: "transcribe", detail: describe(error) });
}

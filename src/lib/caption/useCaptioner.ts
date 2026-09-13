/**
 * The captioning state machine, as a hook.
 *
 * One worker is shared by the whole tab and deliberately outlives the page that
 * created it: the model takes a few seconds to compile and a quarter-gigabyte
 * to download, so leaving the tool and coming back should cost nothing. What it
 * holds is model weights — never anything from the user's file.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { type Cue, layoutLine, type TimedWord, wordsToCues } from "./cues";
import { decodeToMono16k, NoAudioError } from "./decode";
import { cachedBytes, MODEL_TOTAL_BYTES } from "./model";
import type { CaptionFailure, CaptionResponse } from "./protocol";

export interface ModelStatus {
  phase: "idle" | "fetching" | "compiling" | "ready" | "error";
  /** Bytes of the model already on the device. */
  bytesReady: number;
  bytesTotal: number;
  /** True when the last load needed no network at all. */
  fromCache: boolean;
  failure?: CaptionFailure;
  detail?: string;
}

export type RunPhase = "idle" | "reading" | "transcribing" | "done";

export interface CaptionRun {
  phase: RunPhase;
  /** Seconds of media transcribed so far. */
  secondsDone: number;
  /** How far the decode got, 0..1. Only the streaming decoder reports it. */
  readFraction: number;
  duration: number;
  /** `performance.now()` when this run started, for estimating what is left. */
  startedAt: number;
  /** Wall-clock seconds the finished run took. */
  tookSeconds: number;
}

// --------------------------------------------------------------- the worker

let worker: Worker | null = null;
const subscribers = new Set<(message: CaptionResponse) => void>();

let modelStatus: ModelStatus = {
  phase: "idle",
  bytesReady: 0,
  bytesTotal: MODEL_TOTAL_BYTES,
  fromCache: false,
};

/**
 * Whether this browser can actually run the model, not merely whether it has
 * heard of WebGPU.
 *
 * `"gpu" in navigator` is the obvious check and it is not enough: a headless
 * Chrome, a VM, and a machine whose GPU is on the driver blocklist all expose
 * `navigator.gpu` and then hand back no adapter. Believing the property alone
 * means downloading a quarter of a gigabyte before finding that out, and then
 * reporting it as a model failure rather than as a browser that cannot do this.
 * Asking for the adapter costs nothing and answers the real question.
 */
async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

/** Stop any run in flight, without bringing a worker into being to do it. */
function cancelActiveRun(): void {
  worker?.postMessage({ type: "cancel" });
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./caption.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<CaptionResponse>) => {
    modelStatus = reduceModelStatus(modelStatus, event.data);
    for (const notify of subscribers) notify(event.data);
  };
  return worker;
}

function reduceModelStatus(current: ModelStatus, message: CaptionResponse): ModelStatus {
  switch (message.type) {
    case "fetching":
      return { ...current, phase: "fetching", bytesReady: message.bytesReady, bytesTotal: message.bytesTotal };
    case "compiling":
      return { ...current, phase: "compiling", bytesReady: current.bytesTotal };
    case "ready":
      return { ...current, phase: "ready", bytesReady: current.bytesTotal, fromCache: message.fromCache };
    case "failed":
      // A transcription failure says nothing about the model, which is still loaded.
      return message.reason === "transcribe"
        ? current
        : { ...current, phase: "error", failure: message.reason, detail: message.detail };
    default:
      return current;
  }
}

// ----------------------------------------------------------------- the hook

export interface UseCaptioner {
  model: ModelStatus;
  run: CaptionRun;
  cues: Cue[];
  /** Loudness envelope of the current file, 0..1 per bucket. */
  peaks: number[];
  /** Set once a run finishes, so the page can offer downloads. */
  finished: boolean;
  error: string | null;
  start: (file: File) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  editCue: (index: number, text: string) => void;
}

const IDLE_RUN: CaptionRun = {
  phase: "idle",
  secondsDone: 0,
  readFraction: 0,
  duration: 0,
  startedAt: 0,
  tookSeconds: 0,
};

export function useCaptioner(): UseCaptioner {
  const [model, setModel] = useState<ModelStatus>(modelStatus);
  const [run, setRun] = useState<CaptionRun>(IDLE_RUN);
  const [cues, setCues] = useState<Cue[]>([]);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const durationRef = useRef(0);

  useEffect(() => {
    let left = false;

    const onMessage = (message: CaptionResponse) => {
      setModel(modelStatus);

      if (message.type === "waveform") {
        if (message.runId === runIdRef.current) setPeaks(message.peaks);
        return;
      }

      if (message.type === "words") {
        if (message.runId !== runIdRef.current) return;
        setCues(wordsToCues(message.words as TimedWord[], durationRef.current));
        setRun((previous) => ({ ...previous, secondsDone: message.secondsDone }));
        return;
      }

      if (message.type === "done") {
        if (message.runId !== runIdRef.current) return;
        setRun((previous) => ({
          ...previous,
          phase: "done",
          secondsDone: previous.duration,
          tookSeconds: message.ms / 1000,
        }));
        return;
      }

      if (message.type === "failed") {
        // Whatever broke, a run that was waiting on it is over.
        setRun((previous) => (previous.phase === "idle" ? previous : { ...previous, phase: "idle" }));
        if (message.reason === "transcribe") {
          setError(message.detail || "The browser ran out of room part way through this file.");
        } else if (message.reason === "model") {
          setError("The speech model could not be loaded. Reloading the page usually fixes it.");
        }
        // "no-webgpu" is reported through the model status instead: it is not a
        // failure of this run, it is a browser that can never do this at all.
      }
    };

    // Subscribed before anything async: a file dropped while the adapter probe
    // is still resolving reaches the worker through start(), and its first
    // messages must not arrive with nobody listening.
    subscribers.add(onMessage);

    void (async () => {
      // Settle the "can this browser do it at all" question before spawning a
      // worker, so an unsupported browser is told so on arrival rather than
      // after it has waited for a file to decode.
      const supported = await hasWebGPU();
      if (left) return;

      if (!supported) {
        modelStatus = { ...modelStatus, phase: "error", failure: "no-webgpu" };
        setModel(modelStatus);
        return;
      }

      const instance = getWorker();
      setModel(modelStatus);

      // A load that failed for a transient reason (a dropped connection mid
      // download) is worth retrying when the tool is opened again.
      if (modelStatus.phase === "idle" || (modelStatus.phase === "error" && modelStatus.failure === "model")) {
        // Warm up ahead of time only when the weights are already on the
        // device, where it costs nothing and makes the first file start
        // instantly. Pulling a quarter of a gigabyte is not something to do to
        // someone who has merely opened a page to look at it — that waits for
        // a real file.
        const bytes = await cachedBytes();
        if (left || bytes < MODEL_TOTAL_BYTES) return;
        modelStatus = { ...modelStatus, phase: "idle", failure: undefined, detail: undefined };
        instance.postMessage({ type: "load" });
      }
    })();

    return () => {
      left = true;
      subscribers.delete(onMessage);
      // Leaving the tool abandons the run: the cues live in this component's
      // state, so a transcription still grinding away on the GPU is producing
      // words nothing will ever read. The worker itself stays, model and all.
      runIdRef.current += 1;
      cancelActiveRun();
    };
  }, []);

  const start = useCallback(async (file: File) => {
    const instance = getWorker();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    // Stop whatever the worker is doing before queueing more work behind it.
    instance.postMessage({ type: "cancel" });
    setError(null);
    setCues([]);
    setPeaks([]);
    setRun({ ...IDLE_RUN, phase: "reading", startedAt: performance.now() });

    let decoded: Awaited<ReturnType<typeof decodeToMono16k>>;
    try {
      decoded = await decodeToMono16k(file, (fraction) => {
        // Only the streaming path reports this; the native decoder returns in
        // one call and the bar simply stays at its starting position.
        if (runIdRef.current === runId) setRun((previous) => ({ ...previous, readFraction: fraction }));
      });
    } catch (failure) {
      setRun(IDLE_RUN);
      setError(
        failure instanceof NoAudioError
          ? "There is no audio track in that file."
          : "This browser could not read the audio in that file. An MP4, MOV, MP3 or WAV will work.",
      );
      return;
    }

    if (runIdRef.current !== runId) return; // superseded while decoding

    durationRef.current = decoded.duration;
    setRun((previous) => ({ ...previous, phase: "transcribing", duration: decoded.duration }));

    const message = { type: "transcribe" as const, pcm: decoded.pcm, sampleRate: decoded.sampleRate, runId };
    try {
      // Hand the samples over rather than copying them: an hour of audio is
      // 230 MB, and the page has no further use for it.
      instance.postMessage(message, [decoded.pcm.buffer]);
    } catch {
      instance.postMessage(message);
    }
  }, []);

  /**
   * Stop where we are and keep what has been transcribed so far. A run halfway
   * through a two-hour recording still holds usable subtitles for the first
   * hour, so it lands in the same finished state a full run does.
   */
  const cancel = useCallback(() => {
    runIdRef.current += 1;
    getWorker().postMessage({ type: "cancel" });
    setRun((previous) =>
      previous.phase === "transcribing"
        ? { ...previous, phase: "done", tookSeconds: (performance.now() - previous.startedAt) / 1000 }
        : IDLE_RUN,
    );
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    getWorker().postMessage({ type: "cancel" });
    durationRef.current = 0;
    setCues([]);
    setPeaks([]);
    setError(null);
    setRun(IDLE_RUN);
  }, []);

  const editCue = useCallback((index: number, text: string) => {
    setCues((previous) => {
      const next = previous.slice();
      const cue = next[index];
      if (!cue) return previous;
      const laid = layoutLine(text);
      if (laid === cue.text) return previous;
      next[index] = { ...cue, text: laid, edited: true };
      return next;
    });
  }, []);

  return {
    model,
    run,
    cues,
    peaks,
    finished: run.phase === "done",
    error,
    start,
    cancel,
    reset,
    editCue,
  };
}

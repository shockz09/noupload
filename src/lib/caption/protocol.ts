/** Messages exchanged with the caption worker. Shared by both sides. */

import type { TimedWord } from "./cues";

export type CaptionRequest =
  | { type: "load" }
  | { type: "transcribe"; pcm: Float32Array; sampleRate: number; runId: number }
  | { type: "cancel" };

export type CaptionResponse =
  /** Loudness envelope of the decoded audio, for drawing a waveform. */
  | { type: "waveform"; runId: number; peaks: number[] }
  /** Model download progress, in bytes. Only sent while bytes are moving. */
  | { type: "fetching"; bytesReady: number; bytesTotal: number }
  /** Weights are on the device; the runtime is compiling them. */
  | { type: "compiling" }
  | { type: "ready"; fromCache: boolean; ms: number }
  /** One window finished. `words` is the complete list so far, not a delta. */
  | { type: "words"; runId: number; words: TimedWord[]; secondsDone: number }
  | { type: "done"; runId: number; ms: number }
  | { type: "failed"; reason: CaptionFailure; detail?: string };

/** Failure kinds the UI words differently. */
export type CaptionFailure = "no-webgpu" | "model" | "transcribe";

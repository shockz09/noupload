// Pitch-preserving time stretching, shared by the audio and video Speed tools.
//
// Both tools used to resample: reading the samples faster makes the clip shorter but
// multiplies every frequency with it, which is the chipmunk effect. Stretching the
// timeline instead leaves pitch where it was.

import { createYielder } from "../yield";

// WSOLA time-stretching parameters, in frames at the source rate. The window is
// ~43ms at 48kHz, overlapped by half, which is the usual compromise: long enough to
// hold a pitch period of even a low voice, short enough not to smear transients.
const STRETCH_WINDOW = 2048;
const STRETCH_HOP = STRETCH_WINDOW / 2;
/** How far the alignment search may slide a window, ~8ms at 48kHz. */
const STRETCH_SEARCH = 384;
/** Samples compared when scoring an alignment. */
const STRETCH_CORRELATION = 256;
/** The search runs coarsely first, then refines around the winner — a full scan is far too slow. */
const STRETCH_COARSE_STEP = 4;

/**
 * WSOLA time-stretcher: changes how long audio lasts without changing its pitch.
 *
 * Resampling alone can't do this — dropping half the samples doubles every
 * frequency, which is why a sped-up clip sounds like a chipmunk. Instead this takes
 * overlapping windows of the input, slides each one up to `STRETCH_SEARCH` frames to
 * the position where it best continues what was already written, and overlap-adds
 * them at a fixed output hop. Waveform periods line up, so pitch survives while the
 * timeline stretches or squashes.
 *
 * The alignment search is what separates this from plain overlap-add: without it,
 * windows land mid-period and the seams sound like flutter.
 */
export function createTimeStretcher(
  numberOfChannels: number,
  speed: number,
  emit: (planes: Float32Array[]) => Promise<void>,
) {
  // Hann window; at 50% overlap successive windows sum to a constant, so the
  // overlap-add doesn't ripple the volume.
  const window = new Float32Array(STRETCH_WINDOW);
  for (let i = 0; i < STRETCH_WINDOW; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (STRETCH_WINDOW - 1));
  }

  let buffer: Float32Array[] = Array.from({ length: numberOfChannels }, () => new Float32Array(0));
  /** Absolute source index of buffer[…][0]. */
  let bufferStart = 0;
  /** Where the next window would begin if nothing were re-aligned. Fractional, to avoid drift. */
  let analysisPos = 0;
  /** Where the previous window actually began, after alignment. */
  let prevStart = 0;
  let started = false;
  /** Frames in and out, so the tail can be trimmed to the length the video expects. */
  let framesIn = 0;
  let framesOut = 0;
  /** Windowed second half of the previous window, waiting to be added to the next one. */
  const tail: Float32Array[] = Array.from({ length: numberOfChannels }, () => new Float32Array(STRETCH_HOP));

  const at = (channel: number, index: number) => buffer[channel][index - bufferStart] ?? 0;

  /**
   * Score how well the window starting at `start` continues the previous window.
   * Normalised, so a loud stretch doesn't automatically win over a well-aligned one.
   */
  const score = (start: number, reference: Float32Array) => {
    let dot = 0;
    let energy = 0;
    for (let i = 0; i < STRETCH_CORRELATION; i++) {
      const v = at(0, start + i);
      dot += v * reference[i];
      energy += v * v;
    }
    return dot / Math.sqrt(energy + 1e-9);
  };

  const findAlignment = (nominal: number, lo: number, hi: number) => {
    // What the previous window would have run into had it simply carried on.
    const reference = new Float32Array(STRETCH_CORRELATION);
    for (let i = 0; i < STRETCH_CORRELATION; i++) reference[i] = at(0, prevStart + STRETCH_HOP + i);

    let best = nominal;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let candidate = lo; candidate <= hi; candidate += STRETCH_COARSE_STEP) {
      const s = score(candidate, reference);
      if (s > bestScore) {
        bestScore = s;
        best = candidate;
      }
    }
    // Refine within one coarse step of the winner.
    const from = Math.max(lo, best - STRETCH_COARSE_STEP + 1);
    const to = Math.min(hi, best + STRETCH_COARSE_STEP - 1);
    for (let candidate = from; candidate <= to; candidate++) {
      const s = score(candidate, reference);
      if (s > bestScore) {
        bestScore = s;
        best = candidate;
      }
    }
    return best;
  };

  /** Emit one hop of output, mixing the pending tail with the front of a new window. */
  const writeWindow = async (start: number) => {
    const planes: Float32Array[] = [];
    for (let c = 0; c < numberOfChannels; c++) {
      const out = new Float32Array(STRETCH_HOP);
      for (let i = 0; i < STRETCH_HOP; i++) {
        out[i] = tail[c][i] + at(c, start + i) * window[i];
        tail[c][i] = at(c, start + STRETCH_HOP + i) * window[STRETCH_HOP + i];
      }
      planes.push(out);
    }
    framesOut += STRETCH_HOP;
    await emit(planes);
  };

  const bufferEnd = () => bufferStart + (buffer[0]?.length ?? 0);

  const processReady = async (flushing: boolean) => {
    for (;;) {
      const nominal = Math.round(analysisPos);
      const lo = started ? nominal - STRETCH_SEARCH : nominal;
      const hi = started ? nominal + STRETCH_SEARCH : nominal;
      // Everything the alignment search and the window itself may touch.
      const needed = Math.max(hi + STRETCH_WINDOW, prevStart + STRETCH_HOP + STRETCH_CORRELATION);
      if (!flushing && needed > bufferEnd()) return;
      if (flushing && nominal >= bufferEnd()) return;

      const start = started ? findAlignment(nominal, lo, hi) : nominal;
      await writeWindow(start);

      prevStart = start;
      analysisPos += STRETCH_HOP * speed;
      started = true;

      // Drop input no longer reachable by either the next window or the next search.
      const keepFrom = Math.min(prevStart + STRETCH_HOP, Math.round(analysisPos) - STRETCH_SEARCH) - 1;
      if (keepFrom > bufferStart) {
        const drop = keepFrom - bufferStart;
        buffer = buffer.map((b) => b.slice(drop));
        bufferStart = keepFrom;
      }
    }
  };

  return {
    async push(planes: Float32Array[]) {
      framesIn += planes[0]?.length ?? 0;
      buffer = buffer.map((prev, c) => {
        const incoming = planes[c];
        if (prev.length === 0) return incoming;
        const joined = new Float32Array(prev.length + incoming.length);
        joined.set(prev);
        joined.set(incoming, prev.length);
        return joined;
      });
      await processReady(false);
    },

    async finish() {
      // `at()` reads past the end as silence, so the last windows fade out cleanly.
      await processReady(true);
      // The final half-window has no partner to overlap with, so it would otherwise
      // run past the end. Trim it to the length the video track expects rather than
      // leaving audio hanging off the back.
      const remaining = Math.max(0, Math.round(framesIn / speed) - framesOut);
      if (remaining > 0) await emit(tail.map((t) => t.slice(0, Math.min(STRETCH_HOP, remaining))));
    },
  };
}

/**
 * Frames fed to the stretcher at a time. The stretcher drops input it has passed by
 * copying what's left, so handing it a whole file in one push makes that copy scale
 * with the file and the stretch quadratic — a few minutes of audio would lock up the
 * tab. Blocks keep its working buffer small and the cost linear.
 */
const STRETCH_BLOCK_FRAMES = 4096;

/**
 * Stretch de-interleaved PCM in one go, for callers that already hold the whole
 * clip in memory. Returns new planes lasting `1 / speed` as long as the input.
 *
 * Yields between blocks, so a long file leaves the page responsive and `onProgress`
 * (0-1) can actually be seen moving.
 */
export async function timeStretchPlanes(
  planes: Float32Array[],
  speed: number,
  onProgress?: (progress: number) => void,
): Promise<Float32Array[]> {
  const chunks: Float32Array[][] = [];
  const stretcher = createTimeStretcher(planes.length, speed, async (out) => {
    chunks.push(out);
  });
  const frames = planes[0]?.length ?? 0;
  const yieldIfDue = createYielder();
  for (let offset = 0; offset < frames; offset += STRETCH_BLOCK_FRAMES) {
    const end = Math.min(offset + STRETCH_BLOCK_FRAMES, frames);
    await stretcher.push(planes.map((plane) => plane.subarray(offset, end)));
    if (await yieldIfDue()) onProgress?.(end / frames);
  }
  await stretcher.finish();
  onProgress?.(1);

  // WSOLA emits whole hops, so the last one usually overshoots the length the stretch
  // was asked for — under 1%, but enough for the duration the page promised and the
  // duration it delivered to disagree. The surplus is tail past the end of the input;
  // dropping it lands the file exactly where it should end.
  const emitted = chunks.reduce((sum, chunk) => sum + (chunk[0]?.length ?? 0), 0);
  const length = Math.min(emitted, Math.round(frames / speed));
  return planes.map((_, channel) => {
    const merged = new Float32Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      if (offset >= length) break;
      const part = chunk[channel];
      merged.set(offset + part.length <= length ? part : part.subarray(0, length - offset), offset);
      offset += part.length;
    }
    return merged;
  });
}

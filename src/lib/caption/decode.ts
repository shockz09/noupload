/**
 * Getting 16 kHz mono PCM out of whatever the user dropped in.
 *
 * The model wants one channel at 16 kHz and nothing else. Two ways to get
 * there, in order of preference:
 *
 *  1. The browser's own decoder (`decodeAudioData` on a 16 kHz context), which
 *     demuxes, decodes and resamples in one native call. Fastest by a mile and
 *     the resampling is properly filtered.
 *  2. Mediabunny, streaming packets off the file. Slower, but it never holds
 *     the whole file in memory, which is what matters at gigabyte sizes, and it
 *     reads containers on browsers whose Web Audio decoder will not. Chromium's
 *     decoder is the whole media stack and handles every container mediabunny
 *     does, Matroska included — measured, not assumed — so there this is
 *     reached only by the size rule below. Firefox and Safari are narrower.
 *     The app already uses mediabunny for every other video tool.
 *
 * Whole-file decoding through (1) means reading the file into an ArrayBuffer,
 * so anything large goes straight to (2).
 */

import { createYielder } from "@/lib/yield";

export const TARGET_RATE = 16_000;

/** Above this, reading the file into one buffer is a bad idea; stream instead. */
const WHOLE_FILE_LIMIT = 300 * 1024 * 1024;

export interface DecodedAudio {
  pcm: Float32Array;
  sampleRate: number;
  duration: number;
}

export class NoAudioError extends Error {
  constructor() {
    super("no-audio");
  }
}

/**
 * @param onProgress Fraction 0..1, only reported by the streaming path.
 */
export async function decodeToMono16k(file: File, onProgress?: (fraction: number) => void): Promise<DecodedAudio> {
  const streamFirst = file.size > WHOLE_FILE_LIMIT;

  if (!streamFirst) {
    try {
      return await decodeWithWebAudio(file);
    } catch {
      // Falls through: unsupported container, or a codec this browser's Web
      // Audio decoder does not carry. Mediabunny gets a turn.
    }
  }

  try {
    return await decodeStreaming(file, onProgress);
  } catch (error) {
    if (error instanceof NoAudioError) throw error;
    if (streamFirst) {
      // Large file, streaming failed — one last try the simple way.
      return await decodeWithWebAudio(file);
    }
    throw error;
  }
}

async function decodeWithWebAudio(file: File): Promise<DecodedAudio> {
  const context = new AudioContext({ sampleRate: TARGET_RATE });
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.numberOfChannels === 0 || decoded.length === 0) throw new NoAudioError();
    return {
      pcm: downmix(decoded),
      sampleRate: decoded.sampleRate,
      duration: decoded.length / decoded.sampleRate,
    };
  } finally {
    // Contexts are a limited resource; a page that opens one per file runs out.
    void context.close();
  }
}

/** Average the channels together. Mono in, mono out, with no copy. */
function downmix(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);

  const mixed = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < mixed.length; i++) mixed[i] += data[i];
  }
  const scale = 1 / buffer.numberOfChannels;
  for (let i = 0; i < mixed.length; i++) mixed[i] *= scale;
  return mixed;
}

/**
 * Exported for the tests, which otherwise could not reach it: in Chromium the
 * fast path above swallows every container this can read, so the only way in
 * through `decodeToMono16k` is a file too large to run in a test.
 */
export async function decodeStreaming(file: File, onProgress?: (fraction: number) => void): Promise<DecodedAudio> {
  const { AudioBufferSink } = await import("mediabunny");
  const { createInput } = await import("@/lib/video/utils");

  const input = await createInput(file);
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new NoAudioError();

  const duration = await input.computeDuration();

  // Sized from the duration the container reports rather than grown by
  // collecting every decoded chunk and concatenating at the end: this path
  // exists for the files too big to hold twice, and holding the chunks *and*
  // the joined result is exactly that. A second of slack covers a container
  // that rounds its duration down; anything beyond that grows the buffer.
  let pcm = new Float32Array(Math.max(TARGET_RATE, Math.ceil((duration + 1) * TARGET_RATE)));
  let total = 0;

  const append = (samples: Float32Array) => {
    if (total + samples.length > pcm.length) {
      const grown = new Float32Array(Math.max(pcm.length * 2, total + samples.length));
      grown.set(pcm.subarray(0, total));
      pcm = grown;
    }
    pcm.set(samples, total);
    total += samples.length;
  };

  // Awaiting each decoded buffer already returns to the event loop, so this
  // does not by itself block the page — measured on a 60 s MP4, the longest
  // frame gap was 35 ms without the yielder and 30 ms with it. What the yielder
  // buys is a sane rate for the progress below: 982 buffers arrive for a minute
  // of audio, and reporting on every one of them would be 982 renders of a
  // number nobody can read.
  const yielder = createYielder();

  for await (const wrapped of new AudioBufferSink(track).buffers()) {
    append(toMono16k(wrapped.buffer));
    const yielded = await yielder();
    if (yielded && onProgress && duration > 0) {
      onProgress(Math.min(1, (wrapped.timestamp + wrapped.duration) / duration));
    }
  }

  if (total === 0) throw new NoAudioError();
  onProgress?.(1);

  // A view, not a copy: the tail of the buffer is at most the slack above, and
  // copying to trim it would put us back to holding the audio twice.
  const samples = total === pcm.length ? pcm : pcm.subarray(0, total);
  return { pcm: samples, sampleRate: TARGET_RATE, duration: total / TARGET_RATE };
}

/**
 * Downmix and resample one decoded buffer to 16 kHz.
 *
 * Each output sample is the mean of the input samples it spans, rather than a
 * point sample of the nearest one. Averaging is a crude low-pass, but it is the
 * difference between clean speech and aliased hash when going 48 kHz → 16 kHz,
 * and it costs one pass over the data.
 */
function toMono16k(buffer: AudioBuffer): Float32Array {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));

  const ratio = buffer.sampleRate / TARGET_RATE;
  const outLength = Math.max(1, Math.round(buffer.length / ratio));
  const out = new Float32Array(outLength);
  const channelScale = 1 / Math.max(1, channels.length);

  for (let i = 0; i < outLength; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(buffer.length, Math.max(from + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    // Channel outside, samples inside: the inner run walks one typed array
    // forwards, and there is no iterator allocated per sample. An hour of
    // 48 kHz stereo is 350 million trips through here.
    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      for (let s = from; s < to; s++) sum += data[s];
    }
    out[i] = (sum * channelScale) / (to - from);
  }

  return out;
}

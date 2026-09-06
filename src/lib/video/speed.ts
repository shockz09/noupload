// Change a video's playback speed using Mediabunny.
//
// Video: packets are copied through untouched with scaled timestamps whenever the
// source codec belongs in MP4 — no re-encode, so no quality loss and it stays
// fast. Anything else (e.g. VP8 from a WebM) falls back to decode → re-encode.
//
// Audio: has to be resampled. Scaling audio packet timestamps alone would leave
// gaps (slower) or overlaps (faster) that players resync away, so audio is
// decoded to PCM, linearly resampled by the speed factor — the same "tape speed"
// behaviour as the audio Speed tool, pitch included — and re-encoded to AAC.

import type { InputAudioTrack, InputVideoTrack, Mp4OutputFormat } from "mediabunny";
import { assertAudioDecodable } from "./audio-support";
import { createInput, getBaseName } from "./utils";

type MediabunnyMod = typeof import("mediabunny");
type MBVideoCodec = Parameters<MediabunnyMod["canEncodeVideo"]>[0];

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

const VIDEO_CODEC_FALLBACKS: MBVideoCodec[] = ["avc", "vp9", "vp8", "hevc", "av1"];
const AUDIO_BITRATE = 192_000;
const MONO_AUDIO_BITRATE = 128_000;
/**
 * Codecs that may be copied straight into the MP4 container. Mediabunny's muxer
 * will also take VP8, but Chrome refuses `video/mp4; codecs="vp08"`, so a VP8
 * source is re-encoded instead of producing a file the user can't play.
 */
const MP4_COPYABLE_CODECS = ["avc", "hevc", "vp9", "av1"];
/**
 * How negative a first timestamp has to be before it counts as real pre-roll.
 *
 * Container timescales don't divide evenly into seconds, so plenty of ordinary
 * files report a first timestamp a fraction of a microsecond below zero. Genuine
 * pre-roll is at least a frame — milliseconds at any sane frame rate — so 1ms sits
 * comfortably between the two. Treating the rounding noise as pre-roll would push
 * everyday files down the slow, lossy decode path.
 */
const PREROLL_THRESHOLD = 0.001;

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
function createTimeStretcher(numberOfChannels: number, speed: number, emit: (planes: Float32Array[]) => Promise<void>) {
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

/** Frames per emitted audio sample. Big enough to keep encoder calls cheap, small enough to stay streaming. */
const AUDIO_BLOCK_FRAMES = 4096;

/**
 * Whether a track's packets can be re-timed and copied as-is, given the timestamp
 * its first packet carries. Exported for tests: the decision matters more than it
 * looks, and the inputs that exercise it are hard to produce as fixtures.
 */
export function canCopyPacketsThrough(firstTimestamp: number): boolean {
  return firstTimestamp > -PREROLL_THRESHOLD;
}

export interface SpeedOptions {
  /** Playback rate multiplier: 2 plays twice as fast (half the duration), 0.5 half as fast. */
  speed: number;
  /**
   * Keep voices and music at their original pitch (default). Turn this off for the
   * tape effect, where speeding up raises pitch the way the audio Speed tool does.
   */
  preservePitch?: boolean;
}

function validateSpeed(speed: number) {
  // Guarded before any decoding: speed 0 or NaN would otherwise surface as an
  // Infinity timestamp deep inside the muxer with nothing pointing back here.
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("Speed must be a number greater than 0.");
  }
  if (speed < MIN_SPEED || speed > MAX_SPEED) {
    throw new Error(`Speed must be between ${MIN_SPEED}x and ${MAX_SPEED}x.`);
  }
}

/**
 * Resolve the first re-encode codec the browser supports, for sources that can't be
 * copied through. The bitrate is mediabunny's QUALITY_HIGH rather than a fixed
 * number: it scales with resolution and frame rate, and a flat figure that suits
 * 720p turns a 2.8K screen recording to mush.
 */
async function resolveReencodeCodec(mod: MediabunnyMod): Promise<MBVideoCodec> {
  for (const codec of VIDEO_CODEC_FALLBACKS) {
    if (await mod.canEncodeVideo(codec, { bitrate: mod.QUALITY_HIGH })) return codec;
  }
  throw new Error("Your browser does not support video encoding. Try Chrome or Edge.");
}

/**
 * Build the output video source for `track` and a `write` callback that streams its
 * frames into that source, dividing every timestamp by `speed`. The source must be
 * added to the output and the output started before `write` is called.
 */
async function prepareVideoTrack(
  mod: MediabunnyMod,
  format: Mp4OutputFormat,
  track: InputVideoTrack,
  speed: number,
  canCopyThrough: boolean,
  startShift: number,
  duration: number,
  progressShare: number,
) {
  const { EncodedPacketSink, EncodedVideoPacketSource, VideoSampleSink, VideoSampleSource } = mod;
  // Map source timestamp → the leading `progressShare` slice of the progress bar.
  // Packets arrive in *decode* order, so with B-frames their timestamps step
  // backwards; the running max keeps the bar from stuttering back on itself.
  const outDuration = duration / speed;
  let highWater = 0;
  const progress = (t: number) => {
    if (outDuration <= 0) return 0;
    highWater = Math.max(highWater, Math.min((t / speed / outDuration) * progressShare, progressShare));
    return highWater;
  };

  // `startShift` only ever absorbs sub-millisecond rounding noise, so this is an
  // exact rebase rather than a clamp. Clamping a genuinely negative timestamp to
  // zero would silently stack every pre-roll frame on the same instant; files like
  // that take the decode path instead, and if that gate ever fails the muxer's own
  // error is the honest outcome.
  const retime = (t: number) => (t - startShift) / speed;

  const codec = track.codec;
  if (
    canCopyThrough &&
    codec !== null &&
    MP4_COPYABLE_CODECS.includes(codec) &&
    format.getSupportedVideoCodecs().includes(codec)
  ) {
    const source = new EncodedVideoPacketSource(codec);
    const write = async (onProgress?: (p: number) => void) => {
      const sink = new EncodedPacketSink(track);
      const decoderConfig = await track.getDecoderConfig();
      let first = true;
      for await (const packet of sink.packets()) {
        // Scaling timestamp and duration by the same factor keeps decode order and
        // B-frame relationships intact — only the clock changes.
        const scaled = packet.clone({
          timestamp: retime(packet.timestamp),
          duration: packet.duration / speed,
        });
        // The decoder config must accompany the first packet only.
        await source.add(scaled, first ? { decoderConfig: decoderConfig ?? undefined } : undefined);
        first = false;
        onProgress?.(progress(packet.timestamp));
      }
    };
    return { source, write };
  }

  const source = new VideoSampleSource({ codec: await resolveReencodeCodec(mod), bitrate: mod.QUALITY_HIGH });
  const write = async (onProgress?: (p: number) => void) => {
    const sink = new VideoSampleSink(track);
    for await (const sample of sink.samples()) {
      const timestamp = sample.timestamp;
      sample.setTimestamp(retime(timestamp));
      sample.setDuration(sample.duration / speed);
      await source.add(sample);
      sample.close();
      onProgress?.(progress(timestamp));
    }
  };
  return { source, write };
}

/**
 * Pick an AAC configuration the browser will actually accept.
 *
 * Chrome's AAC encoder refuses low sample rates outright — 22050 Hz fails at
 * every bitrate — so a source rate that can't be encoded is resampled up to one
 * that can. Since the audio is going through a resampler anyway, that costs
 * nothing extra.
 */
async function resolveAudioEncoding(mod: MediabunnyMod, numberOfChannels: number, sourceRate: number) {
  const bitrate = numberOfChannels <= 1 ? MONO_AUDIO_BITRATE : AUDIO_BITRATE;
  // Source rate first: keeping it avoids a needless conversion.
  const candidates = [sourceRate, 48000, 44100].filter((r) => r > 0);

  for (const attempt of [0, 1]) {
    for (const sampleRate of candidates) {
      if (await mod.canEncodeAudio("aac", { numberOfChannels, sampleRate, bitrate })) {
        return { sampleRate, bitrate };
      }
    }
    // Nothing native worked — bring in the WASM encoder and try the same list again.
    if (attempt === 0) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    }
  }

  throw new Error("Your browser cannot encode this file's audio. Try Chrome or Edge.");
}

/**
 * Streaming linear-interpolation resampler: advances through the source by
 * `speed * sourceRate / outputRate` per emitted frame, writing fixed-size planar
 * blocks at `outputRate`.
 *
 * The read position and the unconsumed tail carry across chunks — resetting them
 * per decoded sample would put a click at every chunk boundary — and the source
 * frames are kept until the interpolation that needs them has happened.
 */
function createResampler(
  numberOfChannels: number,
  sourceRate: number,
  outputRate: number,
  speedFactor: number,
  startTimestamp: number,
  emit: (data: Float32Array, timestamp: number) => Promise<void>,
) {
  /** Source frames consumed per output frame. */
  const speed = (speedFactor * sourceRate) / outputRate;
  const sampleRate = outputRate;
  let carry: Float32Array[] = Array.from({ length: numberOfChannels }, () => new Float32Array(0));
  /** Fractional read position, in source frames, measured from the start of `carry`. */
  let pos = 0;
  let emittedFrames = 0;

  // Planar layout: channel 0's frames, then channel 1's, ...
  const block = new Float32Array(numberOfChannels * AUDIO_BLOCK_FRAMES);
  let blockFrames = 0;

  const flushBlock = async () => {
    if (blockFrames === 0) return;
    const frames = blockFrames;
    // A partial block (only ever the last one) has to be compacted: the planes
    // must sit back to back or the sample reads silence from the gaps.
    let data: Float32Array;
    if (frames === AUDIO_BLOCK_FRAMES) {
      // Copy — the sample outlives this call and `block` gets overwritten.
      data = block.slice();
    } else {
      data = new Float32Array(numberOfChannels * frames);
      for (let c = 0; c < numberOfChannels; c++) {
        data.set(block.subarray(c * AUDIO_BLOCK_FRAMES, c * AUDIO_BLOCK_FRAMES + frames), c * frames);
      }
    }
    const timestamp = startTimestamp + emittedFrames / sampleRate;
    emittedFrames += frames;
    blockFrames = 0;
    await emit(data, timestamp);
  };

  const writeFrame = async (buffers: Float32Array[], i: number, j: number, frac: number) => {
    for (let c = 0; c < numberOfChannels; c++) {
      const b = buffers[c];
      block[c * AUDIO_BLOCK_FRAMES + blockFrames] = b[i] * (1 - frac) + b[j] * frac;
    }
    blockFrames++;
    if (blockFrames === AUDIO_BLOCK_FRAMES) await flushBlock();
  };

  return {
    async push(planes: Float32Array[]) {
      const buffers = planes.map((plane, c) => {
        const prev = carry[c];
        if (prev.length === 0) return plane;
        const joined = new Float32Array(prev.length + plane.length);
        joined.set(prev);
        joined.set(plane, prev.length);
        return joined;
      });
      const total = buffers[0]?.length ?? 0;

      // Only emit frames whose right-hand interpolation neighbour is already in hand.
      while (Math.floor(pos) + 1 <= total - 1) {
        const i = Math.floor(pos);
        await writeFrame(buffers, i, i + 1, pos - i);
        pos += speed;
      }

      // Drop consumed frames. `pos` can overshoot `total` at high speeds; the
      // leftover offset has to stay on the clock so it skips into the next chunk
      // instead of being silently rewound to the chunk boundary.
      const drop = Math.min(Math.floor(pos), total);
      carry = buffers.map((b) => b.slice(drop));
      pos -= drop;
    },

    async finish() {
      const total = carry[0]?.length ?? 0;
      // Tail frames: clamp the right neighbour so the final source frame is used
      // rather than dropped.
      while (pos <= total - 1) {
        const i = Math.floor(pos);
        await writeFrame(carry, i, Math.min(i + 1, total - 1), pos - i);
        pos += speed;
      }
      await flushBlock();
    },
  };
}

/**
 * Stream `track`'s audio through the resampler into the AAC source.
 *
 * `channels` and `outputRate` are fixed by the encoder config chosen before the
 * output started; the source rate comes from the decoder, which is the authority
 * on what the PCM actually looks like.
 */
async function writeAudioTrack(
  mod: MediabunnyMod,
  track: InputAudioTrack,
  source: InstanceType<MediabunnyMod["AudioSampleSource"]>,
  channels: number,
  outputRate: number,
  speed: number,
  preservePitch: boolean,
  duration: number,
  onProgress?: (p: number) => void,
) {
  const { AudioSample, AudioSampleSink } = mod;
  const sink = new AudioSampleSink(track);

  let resampler: ReturnType<typeof createResampler> | null = null;
  let stretcher: ReturnType<typeof createTimeStretcher> | null = null;

  for await (const sample of sink.samples()) {
    const timestamp = sample.timestamp;
    const frames = sample.numberOfFrames;

    if (!resampler) {
      // With pitch preserved, the stretcher has already changed the duration by the
      // time audio reaches the resampler, which is then only converting sample rate.
      // Without it, the resampler does both at once and the pitch rides along.
      resampler = createResampler(
        channels,
        sample.sampleRate,
        outputRate,
        preservePitch ? 1 : speed,
        Math.max(0, timestamp / speed),
        async (data, ts) => {
          const out = new AudioSample({
            data,
            format: "f32-planar",
            numberOfChannels: channels,
            sampleRate: outputRate,
            timestamp: ts,
          });
          await source.add(out);
          out.close();
        },
      );
      if (preservePitch) {
        const target = resampler;
        stretcher = createTimeStretcher(channels, speed, (planes) => target.push(planes));
      }
    }

    const planes: Float32Array[] = [];
    for (let c = 0; c < channels; c++) {
      const plane = new Float32Array(frames);
      // A decoder that hands back fewer channels than the track advertised would
      // otherwise throw here; reuse the first plane instead of dropping the audio.
      sample.copyTo(plane, { planeIndex: Math.min(c, sample.numberOfChannels - 1), format: "f32-planar" });
      planes.push(plane);
    }
    sample.close();

    await (stretcher ?? resampler).push(planes);
    if (duration > 0) onProgress?.(Math.min(timestamp / duration, 1));
  }

  await stretcher?.finish();
  await resampler?.finish();
}

/**
 * Re-time a video to play at `speed`× its original rate.
 *
 * @returns The MP4 blob and a suggested filename.
 */
export async function changeVideoSpeed(
  file: File,
  options: SpeedOptions,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const { speed, preservePitch = true } = options;
  validateSpeed(speed);

  const mod = await import("mediabunny");
  const { AudioSampleSource, BufferTarget, Mp4OutputFormat, Output } = mod;

  const input = await createInput(file);

  try {
    // Mediabunny throws a bare "Assertion failed." out of its demuxer for formats it
    // can't read (MPEG-4 Part 2, for one), which tells a user nothing. Everything
    // that merely inspects the file is wrapped so the message names the real problem.
    let videoTrack: Awaited<ReturnType<typeof input.getPrimaryVideoTrack>>;
    let audioTrack: Awaited<ReturnType<typeof input.getPrimaryAudioTrack>>;
    let duration: number;
    try {
      videoTrack = await input.getPrimaryVideoTrack();
      audioTrack = await input.getPrimaryAudioTrack();
      duration = await input.computeDuration();
    } catch {
      throw new Error("Could not read this video — the file's format or codec isn't supported.");
    }

    if (!videoTrack) throw new Error("No video track found.");
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not determine the video's duration.");
    }

    // Real files — macOS screen recordings especially — carry pre-roll packets at
    // negative timestamps that an edit list hides from playback. The raw packet sink
    // hands those out as-is, and the muxer rejects a negative timestamp outright,
    // while the decoded sinks already start the presented timeline at zero. So a
    // file that starts before zero goes down the decode path: slower, but its output
    // holds exactly the footage every other tool in this app would produce.
    const videoFirstTs = await videoTrack.getFirstTimestamp();
    const canCopyThrough = canCopyPacketsThrough(videoFirstTs);
    // Only the copy-through path needs this, and then only to absorb sub-millisecond
    // rounding noise so the muxer never sees a negative timestamp. The decode path's
    // samples already start at zero — shifting those would move the whole track.
    const startShift = canCopyThrough ? Math.min(0, videoFirstTs) : 0;

    // A track this browser can't decode used to be dropped here, which handed back a
    // silent video and said nothing. Refusing is the honest answer.
    await assertAudioDecodable(input);
    const useAudio = !!audioTrack;

    const audioChannels = audioTrack?.numberOfChannels || 2;
    const audioEncoding =
      useAudio && audioTrack ? await resolveAudioEncoding(mod, audioChannels, audioTrack.sampleRate) : null;

    const videoShare = useAudio ? 0.8 : 0.95;

    const format = new Mp4OutputFormat({ fastStart: "in-memory" });
    const output = new Output({ format, target: new BufferTarget() });

    const video = await prepareVideoTrack(
      mod,
      format,
      videoTrack,
      speed,
      canCopyThrough,
      startShift,
      duration,
      videoShare,
    );
    // Packet copy-through loses the container's rotation flag, and re-encoding
    // drops it too (a VideoFrame carries no rotation), so re-declare it here.
    output.addVideoTrack(video.source, { rotation: videoTrack.rotation });

    const audioSource = audioEncoding ? new AudioSampleSource({ codec: "aac", bitrate: audioEncoding.bitrate }) : null;
    if (audioSource) output.addAudioTrack(audioSource);

    await output.start();

    await video.write(onProgress);
    video.source.close();

    if (audioSource && audioTrack && audioEncoding) {
      await writeAudioTrack(
        mod,
        audioTrack,
        audioSource,
        audioChannels,
        audioEncoding.sampleRate,
        speed,
        preservePitch,
        duration,
        (p) => onProgress?.(videoShare + p * (0.98 - videoShare)),
      );
      audioSource.close();
    }

    await output.finalize();
    onProgress?.(1);

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
    return { blob, filename: `${getBaseName(file.name)}_${speed}x.mp4` };
  } finally {
    input[Symbol.dispose]();
  }
}

// AAC decoding for browsers whose WebCodecs has no AudioDecoder — mobile Firefox,
// most notably. Without this, `canDecode()` is false for every AAC track, and every
// video tool quietly writes a file with no sound.
//
// Web Audio's decodeAudioData can decode AAC in those browsers, but it wants a whole
// file rather than the raw packets Mediabunny hands out. So the packets are re-wrapped
// in ADTS headers — the self-describing AAC stream format — and decoded in one pass.

import type { EncodedPacket, AudioSample as MBAudioSample } from "mediabunny";

/** Samples per AAC frame. 960 exists but is rare, and ADTS can't express it anyway. */
const FRAME_SAMPLES = 1024;

/**
 * Audio Object Types that carry SBR, where the real output rate is twice the one the
 * config names: HE-AAC (5) and HE-AAC v2 / Parametric Stereo (29).
 */
const SBR_OBJECT_TYPES = [5, 29];

const SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/**
 * Read the profile, sample rate and channel count out of an AudioSpecificConfig — the
 * `description` bytes an MP4 carries for its AAC track.
 */
function parseAudioSpecificConfig(description: Uint8Array) {
  if (description.length < 2) return null;
  const bits = (offset: number, length: number) => {
    let value = 0;
    for (let i = 0; i < length; i++) {
      const bit = offset + i;
      value = (value << 1) | ((description[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    return value;
  };

  let objectType = bits(0, 5);
  let pos = 5;
  if (objectType === 31) {
    objectType = 32 + bits(pos, 6);
    pos += 6;
  }

  const rateIndex = bits(pos, 4);
  pos += 4;
  if (rateIndex === 15) pos += 24; // explicit rate, which ADTS can't express anyway
  const channelConfig = bits(pos, 4);

  return { objectType, rateIndex, channelConfig };
}

/** ADTS can only name profiles 1-4; anything above (HE-AAC's SBR layers) is signalled as LC. */
function adtsProfile(objectType: number) {
  return objectType >= 1 && objectType <= 4 ? objectType - 1 : 1;
}

/**
 * Wrap raw AAC frames in ADTS headers so decodeAudioData will take them. Each frame
 * gets its own 7-byte header carrying the profile, rate and channel count.
 */
function toAdts(packets: Uint8Array[], profile: number, rateIndex: number, channelConfig: number): Uint8Array {
  const total = packets.reduce((n, p) => n + p.length + 7, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const packet of packets) {
    const frameLength = packet.length + 7;
    out[pos] = 0xff;
    out[pos + 1] = 0xf1; // MPEG-4, no CRC
    out[pos + 2] = (profile << 6) | (rateIndex << 2) | ((channelConfig >> 2) & 1);
    out[pos + 3] = ((channelConfig & 3) << 6) | ((frameLength >> 11) & 3);
    out[pos + 4] = (frameLength >> 3) & 0xff;
    out[pos + 5] = ((frameLength & 7) << 5) | 0x1f;
    out[pos + 6] = 0xfc;
    out.set(packet, pos + 7);
    pos += frameLength;
  }
  return out;
}

/**
 * True when the browser can decode AAC through WebCodecs. Mobile Firefox has no
 * AudioDecoder at all; some builds have one that refuses AAC.
 */
async function hasNativeAacDecoder() {
  if (!("AudioDecoder" in globalThis)) return false;
  try {
    const support = await AudioDecoder.isConfigSupported({
      codec: "mp4a.40.2",
      numberOfChannels: 2,
      sampleRate: 48000,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

let registered: Promise<void> | null = null;

/**
 * Register the fallback AAC decoder, but only where WebCodecs can't do the job.
 *
 * Mediabunny prefers a custom decoder over the browser's own, so registering this
 * unconditionally would take work away from a perfectly good native decoder. Runs at
 * most once; safe to call from every tool.
 */
export function ensureAacDecoder(): Promise<void> {
  registered ??= (async () => {
    if (await hasNativeAacDecoder()) return;

    const { AudioSample, CustomAudioDecoder, registerDecoder } = await import("mediabunny");

    class WebAudioAacDecoder extends CustomAudioDecoder {
      static supports(codec: string) {
        return codec === "aac";
      }

      /** Packets awaiting decode, oldest first, with the timestamp each one starts at. */
      private pending: { data: Uint8Array; timestamp: number }[] = [];
      private format: {
        profile: number;
        rateIndex: number;
        channelConfig: number;
        /** Rate to decode at. Twice the frame rate under SBR, which doubles it on the way out. */
        outputRate: number;
      } | null = null;

      init() {
        const description = this.config.description;
        const bytes = description
          ? description instanceof Uint8Array
            ? description
            : new Uint8Array(
                ArrayBuffer.isView(description)
                  ? description.buffer.slice(description.byteOffset, description.byteOffset + description.byteLength)
                  : description,
              )
          : null;

        const parsed = bytes ? parseAudioSpecificConfig(bytes) : null;
        // No description is unusual but survivable: fall back to what the container says.
        const rateIndex = parsed ? parsed.rateIndex : Math.max(0, SAMPLE_RATES.indexOf(this.config.sampleRate));
        const frameRate = SAMPLE_RATES[rateIndex] || this.config.sampleRate;
        // decodeAudioData resamples its output to the context's rate, so the context has
        // to be built at the rate the stream really decodes to. Get this wrong for HE-AAC
        // and the whole top octave is resampled away.
        const sbr = SBR_OBJECT_TYPES.includes(parsed?.objectType ?? 2);
        this.format = {
          profile: adtsProfile(parsed?.objectType ?? 2),
          rateIndex,
          channelConfig: parsed?.channelConfig || this.config.numberOfChannels,
          outputRate: sbr ? frameRate * 2 : frameRate,
        };
      }

      decode(packet: EncodedPacket) {
        // Only buffered here — see flush() for why nothing decodes until the end.
        this.pending.push({ data: packet.data, timestamp: packet.timestamp });
      }

      /**
       * Decode the whole track in one call, then hand it back a packet at a time.
       *
       * Decoding in chunks was the obvious design and it doesn't work. Every
       * decodeAudioData call starts a cold decoder, so the frames at each end of a chunk
       * lack the overlap that joins them to their neighbours; measured against the native
       * decoder that left a ~120ms smear of wrong high band at every seam, and decoding
       * run-up frames on either side only halved it. Chunking also killed the renderer
       * partway through an 84s clip, with a flat JS heap and no error raised — something
       * in the audio engine gives out after a handful of calls.
       *
       * One call has neither problem and comes out bit-identical to WebCodecs. The cost is
       * holding the decoded track in memory: ~30MB for 84s of stereo 44.1kHz, scaling
       * linearly, so a feature-length file would be too big. Fair trade for a path that
       * only runs where the alternative today is no audio at all.
       */
      async flush() {
        const format = this.format;
        const batch = this.pending;
        this.pending = [];
        if (!format || batch.length === 0) return;

        const adts = toAdts(
          batch.map((p) => p.data),
          format.profile,
          format.rateIndex,
          format.channelConfig,
        );
        const context = new OfflineAudioContext(1, 1, format.outputRate);
        // The buffer is copied because decodeAudioData detaches the one it's given.
        const decoded = await context.decodeAudioData(adts.buffer.slice(0) as ArrayBuffer);

        // Samples per frame at the output rate — 2048 rather than 1024 once SBR doubles it.
        const frameRate = SAMPLE_RATES[format.rateIndex] || decoded.sampleRate;
        const perFrame = Math.round((FRAME_SAMPLES * decoded.sampleRate) / frameRate);
        // A decoder may emit its encoder delay before the first real sample. Whatever came
        // out beyond the frames handed in is that padding.
        const padding = Math.max(0, decoded.length - batch.length * perFrame);
        const channels = decoded.numberOfChannels;
        const planes = Array.from({ length: channels }, (_, c) => decoded.getChannelData(c));

        // One AudioSample per packet, the same granularity WebCodecs decodes at. Emitting
        // the lot as a single sample makes multi-second samples that break the sinks
        // downstream, and loses the per-packet timestamps that keep audio lined up to video.
        for (let i = 0; i < batch.length; i++) {
          const start = padding + i * perFrame;
          const length = Math.min(perFrame, Math.max(0, decoded.length - start));
          if (length <= 0) break;
          const data = new Float32Array(length * channels);
          for (let c = 0; c < channels; c++) {
            data.set(planes[c].subarray(start, start + length), c * length);
          }
          this.onSample(
            new AudioSample({
              data,
              format: "f32-planar",
              numberOfChannels: channels,
              sampleRate: decoded.sampleRate,
              timestamp: batch[i].timestamp,
            }) as MBAudioSample,
          );
        }
      }

      close() {
        this.pending = [];
      }
    }

    registerDecoder(WebAudioAacDecoder);
  })();

  return registered;
}

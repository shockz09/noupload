// Video merging using Mediabunny (WebCodecs)
//
// Combines multiple video files into one by decoding samples from each input,
// adjusting timestamps so they play back-to-back, and re-encoding into a
// single MP4 output.
//
// Handles:
//  - Mixed resolutions via sizeChangeBehavior: "contain"
//  - Mixed audio params via OfflineAudioContext resampling
//  - Codec fallback chain for browser compatibility

import { createInput, getBaseName } from "./utils";
import type { VideoInfo } from "./compress";

// ── Types ─────────────────────────────────────────────────────

export interface MergeFileInfo {
  file: File;
  info: VideoInfo;
}

type MediabunnyMod = typeof import("mediabunny");
type MBVideoCodec = Parameters<MediabunnyMod["canEncodeVideo"]>[0];
type MBAudioCodec = Parameters<MediabunnyMod["canEncodeAudio"]>[0];

// ── Codec resolution ──────────────────────────────────────────

const VIDEO_CODEC_FALLBACKS: MBVideoCodec[] = ["avc", "vp9", "vp8", "hevc", "av1"];

async function resolveVideoCodec(
  mod: MediabunnyMod,
  preferred: string,
  bitrate: number,
  height: number | null,
): Promise<MBVideoCodec> {
  const opts = { bitrate, ...(height ? { height } : {}) };
  const codecs: MBVideoCodec[] = [
    preferred as MBVideoCodec,
    ...VIDEO_CODEC_FALLBACKS.filter((c) => c !== preferred),
  ];
  for (const codec of codecs) {
    if (await mod.canEncodeVideo(codec, opts)) return codec;
  }
  throw new Error(
    "Your browser does not support video encoding with these settings. Try Chrome or Edge.",
  );
}

async function resolveAudioCodec(
  mod: MediabunnyMod,
  preferred: string | null,
): Promise<MBAudioCodec> {
  let codec: MBAudioCodec = (preferred as MBAudioCodec) || "aac";

  if (!(await mod.canEncodeAudio(codec))) {
    if (codec === "aac") {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    } else if (codec === "mp3") {
      const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
      registerMp3Encoder();
    }
    if (!(await mod.canEncodeAudio(codec))) {
      if (!(await mod.canEncodeAudio("aac"))) {
        const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
        registerAacEncoder();
      }
      codec = "aac";
    }
  }
  return codec;
}

// ── Audio resampling ──────────────────────────────────────────

/**
 * Resample an AudioBuffer to a target sample rate and channel count
 * using an OfflineAudioContext.
 */
async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number,
  targetNumberOfChannels: number,
): Promise<AudioBuffer> {
  const renderLength = Math.ceil(buffer.duration * targetSampleRate) + 128;
  const ctx = new OfflineAudioContext(targetNumberOfChannels, renderLength, targetSampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

// ── Main ──────────────────────────────────────────────────────

/**
 * Merge multiple video files into a single MP4.
 *
 * Decodes video + audio samples from each file sequentially, shifts
 * timestamps so clips play back-to-back, and re-encodes everything
 * into one output.
 *
 * When input files have different resolutions, frames are scaled to
 * fit via `sizeChangeBehavior: "contain"`. When audio sample rates
 * or channel counts differ, audio is resampled via OfflineAudioContext.
 */
export async function mergeVideos(
  items: MergeFileInfo[],
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  if (items.length === 0) throw new Error("No files to merge");

  const mod = await import("mediabunny");
  const {
    Output,
    Mp4OutputFormat,
    BufferTarget,
    VideoSampleSink,
    VideoSampleSource,
    AudioSampleSink,
    AudioSampleSource,
    AudioSample: MAS,
  } = mod;

  const totalDuration = items.reduce((sum, i) => sum + i.info.duration, 0);
  const targetHeight = items[0].info.height || null;
  const targetBitrate = Math.max(
    ...items.map((i) => i.info.videoBitrate),
    2_000_000,
  );

  // ── Resolve codecs ────────────────────────────────────────

  const videoCodec = await resolveVideoCodec(
    mod,
    items[0].info.videoCodec,
    targetBitrate,
    targetHeight,
  );

  const hasAnyAudio = items.some(
    (i) => i.info.audioBitrate > 0 || i.info.audioCodec !== "unknown",
  );
  const audioCodec = hasAnyAudio
    ? await resolveAudioCodec(mod, items[0].info.audioCodec)
    : null;

  // ── Probe first file for target audio params ──────────────

  let targetSampleRate: number | null = null;
  let targetNumberOfChannels: number | null = null;

  if (audioCodec) {
    const probe = await createInput(items[0].file);
    try {
      const track = await probe.getPrimaryAudioTrack();
      if (track) {
        targetSampleRate = track.sampleRate;
        targetNumberOfChannels = track.numberOfChannels;
      }
    } finally {
      probe[Symbol.dispose]();
    }
  }

  // ── Set up output ─────────────────────────────────────────

  const allSameSize = items.every(
    (i) => i.info.width === items[0].info.width && i.info.height === items[0].info.height,
  );

  const videoSource = new VideoSampleSource({
    codec: videoCodec,
    bitrate: targetBitrate,
    ...(targetHeight ? { height: targetHeight } : {}),
    ...(!allSameSize ? { sizeChangeBehavior: "contain" as const } : {}),
  });

  const audioSource = audioCodec
    ? new AudioSampleSource({ codec: audioCodec, bitrate: 192_000 })
    : null;

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  output.addVideoTrack(videoSource);
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  // ── Process files ─────────────────────────────────────────

  let globalTimeOffset = 0;
  const inputs: any[] = [];

  try {
    for (let i = 0; i < items.length; i++) {
      const { file, info } = items[i];
      const input = await createInput(file);
      inputs.push(input);

      const videoTrack = await input.getPrimaryVideoTrack();
      const audioTrack = await input.getPrimaryAudioTrack();

      if (!videoTrack) {
        throw new Error(`No video track found in ${file.name}`);
      }

      const videoSink = new VideoSampleSink(videoTrack);
      const audioSink = audioTrack ? new AudioSampleSink(audioTrack) : null;
      const duration = info.duration;

      // Determine whether this file's audio needs resampling
      const needsResample =
        audioSink &&
        audioSource &&
        audioTrack &&
        targetSampleRate !== null &&
        targetNumberOfChannels !== null &&
        (audioTrack.sampleRate !== targetSampleRate ||
          audioTrack.numberOfChannels !== targetNumberOfChannels);

      // Video: decode → adjust timestamp → feed to output
      for await (const sample of videoSink.samples(0, duration)) {
        sample.setTimestamp(Math.max(0, sample.timestamp + globalTimeOffset));
        await videoSource.add(sample);
        sample.close();
      }

      // Audio: pass through or resample if params differ
      if (audioSink && audioSource) {
        if (needsResample) {
          await processResampledAudio(
            audioSink,
            audioSource,
            MAS,
            duration,
            globalTimeOffset,
            targetSampleRate!,
            targetNumberOfChannels!,
          );
        } else {
          for await (const sample of audioSink.samples(0, duration)) {
            sample.setTimestamp(Math.max(0, sample.timestamp + globalTimeOffset));
            await audioSource.add(sample);
            sample.close();
          }
        }
      }

      globalTimeOffset += duration;
      onProgress?.(Math.min(globalTimeOffset / totalDuration, 0.95));
    }
  } finally {
    // Always clean up inputs, even on error
    for (const inp of inputs) inp[Symbol.dispose]();
  }

  videoSource.close();
  if (audioSource) audioSource.close();
  await output.finalize();

  onProgress?.(1);

  const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
  return { blob, filename: `${getBaseName(items[0].file.name)}_merged.mp4` };
}

// ── Resampled audio processing ────────────────────────────────

/**
 * Decode all audio from a file, resample to target params via
 * OfflineAudioContext, then feed the result into the output source
 * with adjusted timestamps.
 */
async function processResampledAudio(
  audioSink: InstanceType<typeof import("mediabunny").AudioSampleSink>,
  audioSource: InstanceType<typeof import("mediabunny").AudioSampleSource>,
  MAS: typeof import("mediabunny").AudioSample,
  duration: number,
  globalTimeOffset: number,
  targetSampleRate: number,
  targetNumberOfChannels: number,
): Promise<void> {
  // 1. Collect all decoded samples
  const rawSamples: import("mediabunny").AudioSample[] = [];
  for await (const sample of audioSink.samples(0, duration)) {
    rawSamples.push(sample);
  }

  if (rawSamples.length === 0) return;

  // 2. Merge into a single AudioBuffer
  const totalFrames = rawSamples.reduce((sum, s) => sum + s.numberOfFrames, 0);
  const srcRate = rawSamples[0].sampleRate;
  const srcChannels = rawSamples[0].numberOfChannels;

  const audioBuffer = new AudioBuffer({ numberOfChannels: srcChannels, length: totalFrames, sampleRate: srcRate });

  let frameOffset = 0;
  for (const s of rawSamples) {
    const ab = s.toAudioBuffer();
    for (let ch = 0; ch < srcChannels; ch++) {
      audioBuffer.copyToChannel(ab.getChannelData(ch), ch, frameOffset);
    }
    frameOffset += s.numberOfFrames;
    s.close();
  }

  // 3. Resample to target params
  const resampled = await resampleAudioBuffer(audioBuffer, targetSampleRate, targetNumberOfChannels);

  // 4. Convert back to AudioSamples and feed to output with offset timestamps
  const newSamples = MAS.fromAudioBuffer(resampled, 0);
  for (const ns of newSamples) {
    ns.setTimestamp(Math.max(0, ns.timestamp + globalTimeOffset));
    await audioSource.add(ns);
    ns.close();
  }
}

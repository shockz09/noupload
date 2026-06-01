// Add (replace) an audio track to a video using Mediabunny.
//
// The video track is copied through unchanged (no re-encode, preserving quality
// and speed) whenever its codec is supported by the MP4 container, and only
// re-encoded for codecs MP4 can't hold (e.g. VP8 from some WebM files).
//
// The supplied audio file is decoded via the Web Audio API (so any format the
// browser can decode works — MP3, WAV, AAC, M4A, OGG, FLAC), trimmed to the
// video's duration, then re-encoded to AAC as the video's new audio track.

import type { InputVideoTrack, Mp4OutputFormat } from "mediabunny";
import { loadAudioFile } from "@/lib/audio-utils";
import { createInput, getBaseName } from "./utils";

type MediabunnyMod = typeof import("mediabunny");
type MBVideoCodec = Parameters<MediabunnyMod["canEncodeVideo"]>[0];

const VIDEO_CODEC_FALLBACKS: MBVideoCodec[] = ["avc", "vp9", "vp8", "hevc", "av1"];
const REENCODE_BITRATE = 4_000_000;

/** Resolve the first re-encode codec the browser supports, for the rare non-MP4-compatible source. */
async function resolveReencodeCodec(mod: MediabunnyMod): Promise<MBVideoCodec> {
  for (const codec of VIDEO_CODEC_FALLBACKS) {
    if (await mod.canEncodeVideo(codec, { bitrate: REENCODE_BITRATE })) return codec;
  }
  throw new Error("Your browser does not support video encoding. Try Chrome or Edge.");
}

/**
 * Build the output video source for `track` and a `write` callback that streams
 * its frames into that source. The source must be added to the output and the
 * output started before `write` is called.
 */
async function prepareVideoTrack(
  mod: MediabunnyMod,
  format: Mp4OutputFormat,
  track: InputVideoTrack,
  duration: number,
) {
  const { EncodedPacketSink, EncodedVideoPacketSource, VideoSampleSink, VideoSampleSource } = mod;
  // Map elapsed timestamp → the 0–0.8 slice of the progress bar (audio gets the rest).
  const progress = (t: number) => Math.min((t / duration) * 0.8, 0.8);

  const codec = track.codec;
  if (codec !== null && format.getSupportedVideoCodecs().includes(codec)) {
    const source = new EncodedVideoPacketSource(codec);
    const write = async (onProgress?: (p: number) => void) => {
      const sink = new EncodedPacketSink(track);
      const decoderConfig = await track.getDecoderConfig();
      let first = true;
      for await (const packet of sink.packets()) {
        // The decoder config must accompany the first packet only.
        await source.add(packet, first ? { decoderConfig: decoderConfig ?? undefined } : undefined);
        first = false;
        onProgress?.(progress(packet.timestamp));
      }
    };
    return { source, write };
  }

  const source = new VideoSampleSource({ codec: await resolveReencodeCodec(mod), bitrate: REENCODE_BITRATE });
  const write = async (onProgress?: (p: number) => void) => {
    const sink = new VideoSampleSink(track);
    for await (const sample of sink.samples()) {
      await source.add(sample);
      onProgress?.(progress(sample.timestamp));
      sample.close();
    }
  };
  return { source, write };
}

/** Trim an AudioBuffer to at most `maxDuration` seconds. Returns the input unchanged if already shorter. */
function trimAudioBuffer(buffer: AudioBuffer, maxDuration: number): AudioBuffer {
  if (buffer.duration <= maxDuration) return buffer;
  const length = Math.floor(maxDuration * buffer.sampleRate);
  const trimmed = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(0, length), ch);
  }
  return trimmed;
}

export async function addAudio(
  videoFile: File,
  audioFile: File,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const mod = await import("mediabunny");
  const { Output, Mp4OutputFormat, BufferTarget, AudioBufferSource } = mod;

  // Ensure AAC encoding is available (Safari/Firefox may lack native support).
  if (!(await mod.canEncodeAudio("aac"))) {
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
  }

  // Decode the audio with the Web Audio API. This also validates the file —
  // decodeAudioData throws for anything the browser can't read.
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await loadAudioFile(audioFile);
  } catch {
    throw new Error("Could not read the audio file. Try a different file or format.");
  }

  const videoInput = await createInput(videoFile);
  try {
    const videoTrack = await videoInput.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track found in the video file.");

    const videoDuration = await videoInput.computeDuration();
    if (videoDuration <= 0) throw new Error("Could not determine the video's duration.");

    const format = new Mp4OutputFormat({ fastStart: "in-memory" });
    const output = new Output({ format, target: new BufferTarget() });

    const video = await prepareVideoTrack(mod, format, videoTrack, videoDuration);
    output.addVideoTrack(video.source);

    const audioSource = new AudioBufferSource({ codec: "aac", bitrate: 192_000 });
    output.addAudioTrack(audioSource);

    await output.start();

    await video.write(onProgress);
    video.source.close();

    onProgress?.(0.85);
    await audioSource.add(trimAudioBuffer(audioBuffer, videoDuration));

    await output.finalize();
    onProgress?.(1);

    const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
    return { blob, filename: `${getBaseName(videoFile.name)}_with_audio.mp4` };
  } finally {
    videoInput[Symbol.dispose]();
  }
}

import { createInput, getBaseName } from "./utils";

export interface TrimOptions {
  start: number;
  end: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

/** Single-range trim using mediabunny's built-in Conversion (re-encodes, frame-accurate). */
export async function trimVideo(
  file: File,
  options: TrimOptions,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const { Output, Conversion, Mp4OutputFormat, BufferTarget } = await import("mediabunny");

  const input = await createInput(file);
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: options.start, end: options.end },
  });

  if (onProgress) conversion.onProgress = onProgress;
  await conversion.execute();

  const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
  input[Symbol.dispose]();

  return { blob, filename: `${getBaseName(file.name)}_trimmed.mp4` };
}

/**
 * Multi-range trim: single-pass decode → filter → re-encode.
 *
 * For each keep range, decodes video/audio samples using VideoSampleSink/AudioSampleSink,
 * adjusts timestamps so segments play back-to-back, and feeds them to
 * VideoSampleSource/AudioSampleSource for re-encoding into one output.
 *
 * Frame-accurate, handles B-frames correctly, no intermediate files or concatenation.
 *
 * @param keepRanges - Sorted, non-overlapping time ranges to keep (in seconds).
 */
export async function trimVideoRanges(
  file: File,
  keepRanges: TimeRange[],
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const mod = await import("mediabunny");
  const {
    Output,
    Mp4OutputFormat,
    BufferTarget,
    VideoSampleSink,
    VideoSampleSource,
    AudioSampleSink,
    AudioSampleSource,
    QUALITY_MEDIUM,
  } = mod;

  const input = await createInput(file);
  const videoTrack = await input.getPrimaryVideoTrack();
  const audioTrack = await input.getPrimaryAudioTrack();

  if (!videoTrack) {
    input[Symbol.dispose]();
    throw new Error("No video track found");
  }

  // Resolve codecs — fall back to universally-encodable codecs if source codec isn't supported
  const sourceVideoCodec = videoTrack.codec;
  const sourceAudioCodec = audioTrack?.codec ?? null;

  if (!sourceVideoCodec) {
    input[Symbol.dispose]();
    throw new Error("Unknown video codec");
  }

  // Video: use source codec if encodable, otherwise fall back to H.264
  const videoCodec = (await mod.canEncodeVideo(sourceVideoCodec))
    ? sourceVideoCodec
    : "avc" as const;

  // Audio: use source codec if encodable, otherwise fall back to AAC
  let audioCodec = sourceAudioCodec;
  if (audioCodec && !(await mod.canEncodeAudio(audioCodec))) {
    // Try registering polyfill encoders
    if (audioCodec === "aac") {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    } else if (audioCodec === "mp3") {
      const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
      registerMp3Encoder();
    }
    // If still can't encode, fall back to AAC
    if (!(await mod.canEncodeAudio(audioCodec))) {
      if (!(await mod.canEncodeAudio("aac"))) {
        const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
        registerAacEncoder();
      }
      audioCodec = "aac";
    }
  }

  const totalKeepDuration = keepRanges.reduce((s, r) => s + (r.end - r.start), 0);

  // Encode sources
  const videoSource = new VideoSampleSource({
    codec: videoCodec,
    bitrate: QUALITY_MEDIUM,
  });
  const audioSource = audioTrack && audioCodec
    ? new AudioSampleSource({ codec: audioCodec, bitrate: 192_000 })
    : null;

  // Output
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  output.addVideoTrack(videoSource);
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  // Decode sinks
  const videoSink = new VideoSampleSink(videoTrack);
  const audioSink = audioTrack ? new AudioSampleSink(audioTrack) : null;

  // Process each keep range
  let timeOffset = 0;

  for (const range of keepRanges) {
    const rangeDuration = range.end - range.start;

    // Video frames
    for await (const sample of videoSink.samples(range.start, range.end)) {
      const originalPts = sample.timestamp;
      const adjustedPts = Math.max(0, (originalPts - range.start) + timeOffset);
      sample.setTimestamp(adjustedPts);
      await videoSource.add(sample);
      sample.close();

      const elapsed = timeOffset + (originalPts - range.start);
      onProgress?.(Math.min(elapsed / totalKeepDuration, 0.95));
    }

    // Audio samples
    if (audioSink && audioSource) {
      for await (const sample of audioSink.samples(range.start, range.end)) {
        const adjustedPts = Math.max(0, (sample.timestamp - range.start) + timeOffset);
        sample.setTimestamp(adjustedPts);
        await audioSource.add(sample);
        sample.close();
      }
    }

    timeOffset += rangeDuration;
  }

  videoSource.close();
  if (audioSource) audioSource.close();
  await output.finalize();

  onProgress?.(1);

  const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
  input[Symbol.dispose]();

  return { blob, filename: `${getBaseName(file.name)}_trimmed.mp4` };
}

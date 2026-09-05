// Shared video utilities using Mediabunny

export async function getInputFormats() {
  const { MP4, WEBM, MATROSKA, QTFF } = await import("mediabunny");
  return [MP4, WEBM, MATROSKA, QTFF];
}

export async function createInput(file: File) {
  const { Input, BlobSource } = await import("mediabunny");
  const formats = await getInputFormats();
  return new Input({ source: new BlobSource(file), formats });
}

export function getBaseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

/**
 * Codecs already playable in the given container, so there's no reason to touch them.
 * MOV keeps PCM: QuickTime plays it natively and re-encoding it would throw away a
 * lossless track. MP4 doesn't — nothing plays PCM in an MP4.
 */
const KEEP_AS_IS: Record<"mp4" | "mov", string[]> = {
  mp4: ["mp3"],
  mov: ["mp3", "pcm-s16", "pcm-s16be", "pcm-s24", "pcm-s24be", "pcm-f32", "pcm-u8", "pcm-s8"],
};

/**
 * Audio track options for an MP4/MOV conversion, and the encoder they need.
 *
 * Left to itself, Mediabunny re-encodes a track it can't copy using the first codec
 * the browser can encode — `encodableCodecs[0]` in its Conversion. In Firefox, which
 * has no native AAC encoder, that's Opus, and Opus inside an MP4 plays as silence in
 * Safari, QuickTime, iOS and most editors: the file is fine in the browser that made
 * it and arrives everywhere else with the audio gone. Chrome picks Opus too when the
 * source rate is one its AAC encoder rejects (22050 Hz, as HE-AAC reports).
 *
 * Naming AAC rules that out. It doesn't force a re-encode: Mediabunny's fast path
 * copies the encoded packets whenever `trackOptions.codec` matches the source codec,
 * so an AAC source that would have been copied still is. The WASM encoder is only
 * pulled in when the browser has no native one *and* this file has audio that could
 * need it, so Chrome never loads it and a silent video never pays for it.
 *
 * Decided from the primary audio track and applied to all of them, which is what
 * every tool here wants — none of them expose a second audio track to the user.
 */
export async function audioOptionsFor(
  input: { getPrimaryAudioTrack: () => Promise<{ codec: string | null } | null> },
  container: "mp4" | "mov" = "mp4",
): Promise<{ codec?: "aac" }> {
  const track = await input.getPrimaryAudioTrack();
  const codec = track?.codec ?? null;
  if (!codec) return {};
  if (KEEP_AS_IS[container].includes(codec)) return {};

  // AAC is deliberately not in KEEP_AS_IS. An AAC source usually copies, but HE-AAC
  // and anything Mediabunny has to resample go down the re-encode branch, and that
  // branch is where the Opus fallback lives — so AAC still has to be named.
  await ensureAacEncoder();
  return { codec: "aac" };
}

/**
 * Load the WASM AAC encoder if the browser has none of its own.
 *
 * Firefox and Safari can't encode AAC natively. Costs ~2s once per page load there,
 * and nothing at all in Chrome.
 */
export async function ensureAacEncoder() {
  const { canEncodeAudio } = await import("mediabunny");
  if (await canEncodeAudio("aac")) return;
  const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
  registerAacEncoder();
}

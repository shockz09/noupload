// Shared mediabunny utilities for audio tools

export async function createAudioInput(file: File) {
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

export async function registerAudioEncoders(codecs: ("aac" | "mp3")[]) {
  const mod = await import("mediabunny");

  for (const codec of codecs) {
    if (codec === "aac" && !(await mod.canEncodeAudio("aac"))) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    }
    if (codec === "mp3" && !(await mod.canEncodeAudio("mp3"))) {
      const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
      registerMp3Encoder();
    }
  }
}

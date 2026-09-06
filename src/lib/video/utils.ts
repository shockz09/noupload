// Shared video utilities using Mediabunny

import { ensureAacDecoder } from "./aac-decoder";

export async function getInputFormats() {
  const { MP4, WEBM, MATROSKA, QTFF } = await import("mediabunny");
  return [MP4, WEBM, MATROSKA, QTFF];
}

export async function createInput(file: File) {
  const { Input, BlobSource } = await import("mediabunny");
  const formats = await getInputFormats();
  // Every tool reads its input through here, so this is the one place that has to know
  // about browsers with no WebCodecs AudioDecoder. Without it they all report the audio
  // as undecodable and silently write a file with no sound.
  await ensureAacDecoder();
  return new Input({ source: new BlobSource(file), formats });
}

export function getBaseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

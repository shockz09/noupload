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

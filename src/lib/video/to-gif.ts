export interface GifOptions {
  fps: number;
  width: number | "original";
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener("seeked", handler);
      resolve();
    };
    video.addEventListener("seeked", handler);
    video.currentTime = time;
  });
}

export async function videoToGif(
  file: File,
  options: GifOptions,
  onProgress?: (progress: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video"));
  });

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  let w: number;
  let h: number;
  if (options.width === "original") {
    w = srcW;
    h = srcH;
  } else {
    w = Math.min(options.width, srcW);
    h = Math.round((w / srcW) * srcH);
  }
  // GIF dimensions must be even
  w = w & ~1;
  h = h & ~1;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const gif = GIFEncoder();
  const delay = Math.round(1000 / options.fps);
  const duration = video.duration;
  const frameInterval = 1 / options.fps;
  const totalFrames = Math.floor(duration * options.fps);

  for (let i = 0; i < totalFrames; i++) {
    await seekTo(video, i * frameInterval);

    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay });

    onProgress?.((i + 1) / totalFrames);
  }

  gif.finish();
  URL.revokeObjectURL(url);
  canvas.width = 0;
  canvas.height = 0;

  const blob = new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return { blob, filename: `${baseName}.gif` };
}

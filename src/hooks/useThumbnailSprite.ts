import { useEffect, useRef, useState } from "react";

interface ThumbnailSprite {
  /** Data URL of the vertical sprite sheet (JPEG) */
  url: string;
  /** Number of thumbnails in the sprite */
  count: number;
  /** Width of each thumbnail in pixels */
  width: number;
  /** Height of each thumbnail in pixels */
  height: number;
}

interface SpriteState {
  sprite: ThumbnailSprite | null;
  loading: boolean;
}

/**
 * Generates a thumbnail sprite sheet from a video URL.
 * Returns { sprite, loading } where sprite is null until generation completes.
 *
 * The sprite is a single image with `count` thumbnails stacked vertically,
 * each captured at evenly-spaced timestamps across the video duration.
 */
export function useThumbnailSprite(
  videoUrl: string | null,
  count = 10,
): SpriteState {
  const [state, setState] = useState<SpriteState>({ sprite: null, loading: false });
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!videoUrl) {
      setState({ sprite: null, loading: false });
      return;
    }

    cancelledRef.current = false;
    setState({ sprite: null, loading: true });

    let cancelled = false;

    (async () => {
      const vid = document.createElement("video");
      vid.crossOrigin = "anonymous";
      vid.muted = true;
      vid.preload = "auto";
      vid.src = videoUrl;

      try {
        // Wait for metadata
        await new Promise<void>((resolve, reject) => {
          vid.onloadeddata = () => resolve();
          vid.onerror = () => reject(new Error("Failed to load video for thumbnails"));
        });

        if (cancelled) return;

        const duration = vid.duration;
        if (!duration || !isFinite(duration)) return;

        const thumbHeight = 90;
        const aspect = vid.videoWidth / vid.videoHeight || 16 / 9;
        const thumbWidth = Math.round(thumbHeight * aspect);

        const canvas = document.createElement("canvas");
        canvas.width = thumbWidth;
        canvas.height = thumbHeight * count;
        const ctx = canvas.getContext("2d")!;

        for (let i = 0; i < count; i++) {
          // Seek to the midpoint of each segment
          const t = Math.min(((i + 0.5) / count) * duration, duration - 0.05);
          vid.currentTime = t;

          await new Promise<void>((resolve) => {
            vid.onseeked = () => resolve();
          });

          if (cancelled) return;

          ctx.drawImage(vid, 0, i * thumbHeight, thumbWidth, thumbHeight);
        }

        if (cancelled) return;

        const spriteUrl = canvas.toDataURL("image/jpeg", 0.5);

        if (!cancelled) {
          setState({
            sprite: { url: spriteUrl, count, width: thumbWidth, height: thumbHeight },
            loading: false,
          });
        }
      } catch {
        // Silently fail — thumbnails are non-essential
        if (!cancelled) {
          setState({ sprite: null, loading: false });
        }
      } finally {
        vid.src = "";
      }
    })();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [videoUrl, count]);

  return state;
}

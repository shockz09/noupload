import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { hasFfmpeg, mp4Quadrants } from "./helpers/fixtures";
import { toBytes } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

/**
 * Flipping has to move the pixels, and has to move the *right* pixels.
 *
 * A mirror has no header field to hide in — MP4 can only declare rotations — so
 * every mirrored frame is drawn and re-encoded, and the only way to know it came
 * out the right way round is to decode the result and look at it. That's what
 * these specs do: the fixture is four solid colour quadrants, so four pixels out
 * of a decoded frame name the transform exactly.
 *
 * The other half of the tool is the arithmetic: mirroring in both axes is the same
 * map as a half turn, and a half turn is metadata, so that combination has to come
 * back out of the copy path rather than costing a full re-encode. Turning a video is
 * /video/rotate's job, and is covered by its own spec.
 */

/** Clockwise from the top-left, as `mp4Quadrants` paints them. */
const SOURCE = ["red", "green", "white", "blue"] as const; // TL, TR, BR, BL
type Corner = "TL" | "TR" | "BR" | "BL";
type Quadrants = Record<Corner, string>;

const source: Quadrants = { TL: SOURCE[0], TR: SOURCE[1], BR: SOURCE[2], BL: SOURCE[3] };

interface Probe {
  rotation: number;
  codedWidth: number;
  codedHeight: number;
  displayWidth: number;
  displayHeight: number;
  codec: string | null;
  packetCount: number;
  /** Computed from the real packet sizes, so it tells a copy from a re-encode. */
  bitrate: number;
  hasAudio: boolean;
}

async function probeBytes(page: Page, bytes: number[], name: string): Promise<Probe> {
  return page.evaluate(
    async ({ b, name }) => {
      const file = new File([new Uint8Array(b)], name);
      // @ts-expect-error -- dev-server module path
      const { createInput } = await import("/src/lib/video/utils.ts");

      const input = await createInput(file);
      const track = await input.getPrimaryVideoTrack();
      const stats = await track.computePacketStats();

      return {
        rotation: track.rotation,
        codedWidth: track.codedWidth,
        codedHeight: track.codedHeight,
        displayWidth: track.displayWidth,
        displayHeight: track.displayHeight,
        codec: track.codec,
        packetCount: stats.packetCount,
        bitrate: stats.averageBitrate,
        hasAudio: (await input.getPrimaryAudioTrack()) !== null,
      };
    },
    { b: bytes, name },
  );
}

/**
 * The colour in each corner of a real decoded frame.
 *
 * Played through a `<video>` rather than a decoder so the reading is the one a
 * viewer gets, and sampled a quarter of the way in from each edge so H.264's
 * chroma subsampling along the quadrant seams can't reach the sample points.
 */
async function cornersOf(page: Page, bytes: number[]): Promise<Quadrants & { width: number; height: number }> {
  return page.evaluate(async (b) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(b)], { type: "video/mp4" }));
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onerror = () => reject(new Error("the browser could not play the flipped file"));
        video.onseeked = () => resolve();
        video.onloadeddata = () => {
          video.currentTime = 1;
        };
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0);

      const REFERENCES: [string, [number, number, number]][] = [
        ["red", [255, 0, 0]],
        ["green", [0, 255, 0]],
        ["blue", [0, 0, 255]],
        ["white", [255, 255, 255]],
      ];
      const at = (fx: number, fy: number) => {
        const [r, g, bl] = ctx.getImageData(Math.round(canvas.width * fx), Math.round(canvas.height * fy), 1, 1).data;
        let best = "?";
        let bestDistance = Infinity;
        for (const [name, [rr, gg, bb]] of REFERENCES) {
          const distance = (r - rr) ** 2 + (g - gg) ** 2 + (bl - bb) ** 2;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = name;
          }
        }
        return best;
      };

      return {
        TL: at(0.25, 0.25),
        TR: at(0.75, 0.25),
        BR: at(0.75, 0.75),
        BL: at(0.25, 0.75),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }, bytes);
}

interface Mirror {
  horizontal: boolean;
  vertical: boolean;
}

async function flip(page: Page, fixture: string, name: string, mirror: Mirror) {
  const out = await page.evaluate(
    async ({ b, name, mirror }) => {
      const file = new File([new Uint8Array(b)], name);
      // @ts-expect-error -- dev-server module path
      const { flipVideo } = await import("/src/lib/video/flip.ts");
      const result = await flipVideo(file, mirror);
      return {
        bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())),
        videoReEncoded: result.videoReEncoded as boolean,
        filename: result.filename as string,
      };
    },
    { b: toBytes(readFileSync(fixture)), name, mirror },
  );

  return {
    ...out,
    probe: () => probeBytes(page, out.bytes, "out.mp4"),
    corners: () => cornersOf(page, out.bytes),
  };
}

test.beforeEach(async ({ page }) => {
  // Vite only serves /src/* once the page is on the app origin.
  await page.goto("/video/flip");
});

test("the fixture starts out the way the specs below assume", async ({ page }) => {
  const corners = await cornersOf(page, toBytes(readFileSync(mp4Quadrants("flip-source.mp4"))));
  expect(corners).toMatchObject(source);
  expect(corners.width).toBe(320);
  expect(corners.height).toBe(240);
});

test("mirroring left-to-right swaps the two halves and keeps the audio", async ({ page }) => {
  const fixture = mp4Quadrants("flip-source.mp4");
  const out = await flip(page, fixture, "clip.mp4", { horizontal: true, vertical: false });

  expect(out.videoReEncoded).toBe(true);
  expect(out.filename).toBe("clip_flipped.mp4");
  expect(await out.corners()).toMatchObject({ TL: "green", TR: "red", BR: "blue", BL: "white" });

  const probe = await out.probe();
  // Baked into the frames, so no header is needed to read the result correctly.
  expect(probe.rotation).toBe(0);
  expect(probe.displayWidth).toBe(320);
  expect(probe.displayHeight).toBe(240);
  expect(probe.hasAudio).toBe(true);
});

test("mirroring top-to-bottom swaps the top and bottom halves", async ({ page }) => {
  const fixture = mp4Quadrants("flip-source.mp4");
  const out = await flip(page, fixture, "clip.mp4", { horizontal: false, vertical: true });

  expect(out.videoReEncoded).toBe(true);
  expect(await out.corners()).toMatchObject({ TL: "blue", TR: "white", BR: "green", BL: "red" });
});

test("mirroring both ways is a half turn, so the video is copied untouched", async ({ page }) => {
  const fixture = mp4Quadrants("flip-source.mp4");
  const before = await probeBytes(page, toBytes(readFileSync(fixture)), "clip.mp4");
  const out = await flip(page, fixture, "clip.mp4", { horizontal: true, vertical: true });

  expect(out.videoReEncoded).toBe(false);

  const probe = await out.probe();
  expect(probe.rotation).toBe(180);
  // Untouched bitstream: same codec, same coded frame, same packets, same payload.
  expect(probe.codec).toBe(before.codec);
  expect(probe.packetCount).toBe(before.packetCount);
  expect(probe.bitrate).toBeCloseTo(before.bitrate, -2);
  expect(probe.hasAudio).toBe(true);
});

test("asking for nothing is refused rather than writing a pointless copy", async ({ page }) => {
  const message = await page.evaluate(async () => {
    // @ts-expect-error -- dev-server module path
    const { flipVideo } = await import("/src/lib/video/flip.ts");
    try {
      await flipVideo(new File([new Uint8Array([0])], "clip.mp4"), { horizontal: false, vertical: false });
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  });

  expect(message).toBe("Pick a direction to mirror in first.");
});

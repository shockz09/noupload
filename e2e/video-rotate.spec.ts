import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { hasFfmpeg, mp4Rotated, mp4WithAudio, webmVp8 } from "./helpers/fixtures";
import { toBytes } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

/**
 * Rotating an MP4 must not re-encode it.
 *
 * An MP4 keeps rotation as a transform in the track header, so turning one is a
 * header rewrite over copied packets — instant, and pixel-for-pixel the original.
 * Anything that quietly forces a transcode (naming a codec, asking for a size, or
 * turning off `allowRotationMetadata`) throws that away and re-encodes every frame
 * instead, which is slow and lossy. These specs pin the fast path down by reading
 * the output back: same codec, same coded frame, same packets, rotation on top.
 *
 * The bake path is the deliberate opposite — pixels turned, no metadata — for the
 * few players that ignore the header, and for codecs an MP4 can't safely hold.
 */

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

/** Reads bytes the way a player would: what the file declares, and what it holds. */
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

const probe = (page: Page, fixture: string, name: string) => probeBytes(page, toBytes(readFileSync(fixture)), name);

/** Rotates through the real tool, then probes the bytes it produced. */
async function rotateAndProbe(
	page: Page,
	fixture: string,
	name: string,
	angle: 90 | 180 | 270,
	options?: { bake?: boolean },
): Promise<Probe & { videoReEncoded: boolean; filename: string }> {
	const out = await page.evaluate(
		async ({ b, name, angle, options }) => {
			const file = new File([new Uint8Array(b)], name);
			// @ts-expect-error -- dev-server module path
			const { rotateVideo } = await import("/src/lib/video/rotate.ts");
			const result = await rotateVideo(file, angle, options);
			return {
				bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())),
				videoReEncoded: result.videoReEncoded as boolean,
				filename: result.filename as string,
			};
		},
		{ b: toBytes(readFileSync(fixture)), name, angle, options },
	);

	return { ...(await probeBytes(page, out.bytes, "out.mp4")), videoReEncoded: out.videoReEncoded, filename: out.filename };
}

test.beforeEach(async ({ page }) => {
	// Vite only serves /src/* once the page is on the app origin.
	await page.goto("/video/rotate");
});

test("rotating an MP4 copies the video and writes the angle into the header", async ({ page }) => {
	const fixture = mp4WithAudio("rotate-source.mp4");
	const before = await probe(page, fixture, "clip.mp4");
	const after = await rotateAndProbe(page, fixture, "clip.mp4", 90);

	expect(after.videoReEncoded).toBe(false);
	expect(after.rotation).toBe(90);

	// Untouched bitstream: same codec, same coded frame, same packets, same payload.
	// A re-encode keeps the frame count but never lands on the same bitrate.
	expect(after.codec).toBe(before.codec);
	expect(after.codedWidth).toBe(before.codedWidth);
	expect(after.codedHeight).toBe(before.codedHeight);
	expect(after.packetCount).toBe(before.packetCount);
	expect(after.bitrate).toBeCloseTo(before.bitrate, -2);

	// Players read the rotation, so the frame arrives on its side.
	expect(after.displayWidth).toBe(before.displayHeight);
	expect(after.displayHeight).toBe(before.displayWidth);
	expect(after.hasAudio).toBe(true);
	expect(after.filename).toBe("clip_rotated90.mp4");
});

test("a half turn also stays a copy", async ({ page }) => {
	const fixture = mp4WithAudio("rotate-source.mp4");
	const before = await probe(page, fixture, "clip.mp4");
	const after = await rotateAndProbe(page, fixture, "clip.mp4", 180);

	expect(after.videoReEncoded).toBe(false);
	expect(after.rotation).toBe(180);
	expect(after.bitrate).toBeCloseTo(before.bitrate, -2);
	// A half turn leaves the frame the way it was.
	expect(after.displayWidth).toBe(before.displayWidth);
	expect(after.displayHeight).toBe(before.displayHeight);
});

test("rotation adds to what the file already declares", async ({ page }) => {
	// The fixture carries a quarter turn of its own, which reads back as 270° clockwise.
	const fixture = mp4Rotated("rotate-prerotated.mp4");
	const before = await probe(page, fixture, "phone.mp4");
	expect(before.rotation).toBe(270);

	const after = await rotateAndProbe(page, fixture, "phone.mp4", 90);

	// 270 + 90 comes back round to none at all, which is the point: the tool turns
	// the video the viewer sees, not the frames underneath it.
	expect(after.rotation).toBe(0);
	expect(after.videoReEncoded).toBe(false);
	expect(after.displayWidth).toBe(before.displayHeight);
	expect(after.displayHeight).toBe(before.displayWidth);
});

test("baking turns the pixels and leaves no rotation behind", async ({ page }) => {
	const fixture = mp4WithAudio("rotate-source.mp4");
	const before = await probe(page, fixture, "clip.mp4");
	const after = await rotateAndProbe(page, fixture, "clip.mp4", 90, { bake: true });

	expect(after.videoReEncoded).toBe(true);
	expect(after.rotation).toBe(0);
	// The frame itself is now upright, so players need no header to read.
	expect(after.codedWidth).toBe(before.codedHeight);
	expect(after.codedHeight).toBe(before.codedWidth);
	expect(after.displayWidth).toBe(before.displayHeight);
	expect(after.hasAudio).toBe(true);
});

test("a codec an MP4 can't safely hold is baked, not copied", async ({ page }) => {
	// VP8 fits in an MP4 by spec, but a .mp4 carrying it plays nowhere but a browser.
	const fixture = webmVp8("rotate-source.webm");
	const before = await probe(page, fixture, "clip.webm");
	const after = await rotateAndProbe(page, fixture, "clip.webm", 90);

	expect(after.videoReEncoded).toBe(true);
	expect(after.codec).toBe("avc");
	expect(after.rotation).toBe(0);
	expect(after.codedWidth).toBe(before.codedHeight);
	expect(after.codedHeight).toBe(before.codedWidth);
	expect(after.hasAudio).toBe(true);
});

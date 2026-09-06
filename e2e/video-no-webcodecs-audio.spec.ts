import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hasFfmpeg, hasHeAacEncoder, mp4HeAac, mp4WithAudio } from "./helpers/fixtures";
import { toBytes } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

/**
 * Every video tool has to keep the audio in a browser whose WebCodecs has no
 * AudioDecoder — mobile Firefox, where this was reported.
 *
 * Mediabunny asks `canDecode()` before touching an audio track, that goes to WebCodecs,
 * and a false answer makes each tool drop the track and write a soundless file without
 * raising anything. Six of the seven did exactly that. `ensureAacDecoder()` registers a
 * decodeAudioData-backed decoder so the answer is true again.
 *
 * Deleting AudioDecoder is a fair stand-in: it's the single capability those browsers
 * lack, and it's what `canDecode()` consults.
 */

type Probe = { hasAudio: boolean; rms: number | null; duration: number; err?: string };

const TOOLS = ["speed", "rotate", "resize", "crop", "trim", "compress", "convert"] as const;

async function runTool(page: Page, fixture: string, tool: string): Promise<Probe> {
	const bytes = toBytes(readFileSync(fixture));
	return page.evaluate(
		async ({ b, tool }) => {
			const file = new File([new Uint8Array(b)], "clip.mp4", { type: "video/mp4" });
			// @ts-expect-error -- dev-server module path
			const { createInput } = await import("/src/lib/video/utils.ts");

			const call = async (): Promise<{ blob: Blob }> => {
				switch (tool) {
					case "speed": {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/speed.ts");
						return m.changeVideoSpeed(file, { speed: 0.5 }, () => {});
					}
					case "rotate": {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/rotate.ts");
						return m.rotateVideo(file, 90);
					}
					case "resize": {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/resize.ts");
						return m.resizeVideo(file, { height: 180 });
					}
					case "crop": {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/crop.ts");
						return m.cropVideo(file, { left: 0, top: 0, width: 160, height: 120 });
					}
					case "trim": {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/trim.ts");
						return m.trimVideo(file, { start: 0, end: 1 });
					}
					case "compress": {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/compress.ts");
						return m.compressVideo(file, { quality: "medium" });
					}
					default: {
						// @ts-expect-error -- dev-server module path
						const m = await import("/src/lib/video/convert.ts");
						return m.convertVideo(file, "mp4");
					}
				}
			};

			let blob: Blob;
			try {
				blob = (await call()).blob;
			} catch (e) {
				return { hasAudio: false, rms: null, duration: 0, err: String(e) };
			}

			const input = await createInput(new File([blob], "out.mp4", { type: "video/mp4" }));
			const hasAudio = !!(await input.getPrimaryAudioTrack());
			input[Symbol.dispose]();

			let rms: number | null = null;
			let duration = 0;
			try {
				const ctx = new AudioContext();
				const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
				const d = buf.getChannelData(0);
				let sum = 0;
				for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
				rms = Math.sqrt(sum / d.length);
				duration = buf.duration;
				ctx.close();
			} catch {
				// The browser running the test may not decode its own output; the track
				// check above still stands.
			}
			return { hasAudio, rms, duration };
		},
		{ b: bytes, tool },
	);
}

/** Strips the one capability mobile Firefox is missing. */
async function withoutWebCodecsAudio(page: Page) {
	await page.addInitScript(() => {
		// @ts-expect-error -- emulating a browser without WebCodecs audio
		delete window.AudioDecoder;
	});
}

test("the fallback decoder makes AAC decodable again", async ({ page }) => {
	await withoutWebCodecsAudio(page);
	await page.goto("/video/speed", { waitUntil: "domcontentloaded" });
	const bytes = toBytes(readFileSync(mp4WithAudio("nowc.mp4")));
	const state = await page.evaluate(async ({ b }) => {
		const file = new File([new Uint8Array(b)], "clip.mp4", { type: "video/mp4" });
		// @ts-expect-error -- dev-server module path
		const { createInput } = await import("/src/lib/video/utils.ts");
		const input = await createInput(file);
		const track = await input.getPrimaryAudioTrack();
		const out = { hasAudioDecoder: "AudioDecoder" in globalThis, canDecode: await track.canDecode() };
		input[Symbol.dispose]();
		return out;
	}, { b: bytes });

	expect(state.hasAudioDecoder).toBe(false);
	expect(state.canDecode).toBe(true);
});

for (const tool of TOOLS) {
	test(`${tool} keeps audio without WebCodecs audio`, async ({ page }) => {
		test.setTimeout(120_000);
		await withoutWebCodecsAudio(page);
		await page.goto("/video/speed", { waitUntil: "domcontentloaded" });
		const probe = await runTool(page, mp4WithAudio("nowc.mp4"), tool);
		expect(probe.err).toBeUndefined();
		expect(probe.hasAudio).toBe(true);
		// A track that exists but is silent is the same bug wearing a hat.
		if (probe.rms !== null) expect(probe.rms).toBeGreaterThan(0.01);
	});
}

test("HE-AAC decodes at its real rate, not the half-rate the header names", async ({ page }) => {
	test.setTimeout(120_000);
	test.skip(!hasHeAacEncoder(), "needs ffmpeg's aac_at encoder to build an HE-AAC fixture");
	await withoutWebCodecsAudio(page);
	await page.goto("/video/speed", { waitUntil: "domcontentloaded" });

	// SBR doubles the rate on the way out. Decoding at the rate the config names throws
	// the top octave away, which shows up as a track half as long as it should be.
	const probe = await runTool(page, mp4HeAac("nowc-he.mp4"), "rotate");
	expect(probe.err).toBeUndefined();
	expect(probe.hasAudio).toBe(true);
	if (probe.rms !== null) {
		expect(probe.rms).toBeGreaterThan(0.01);
		expect(probe.duration).toBeGreaterThan(2.5);
	}
});

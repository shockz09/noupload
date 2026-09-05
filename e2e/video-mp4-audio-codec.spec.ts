import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hasFfmpeg, hasHeAacEncoder, mp4HeAac, mp4NoAudio, mp4WithAudio } from "./helpers/fixtures";
import { toBytes } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

/**
 * An MP4 or MOV must never come out carrying Opus audio.
 *
 * Mediabunny defaults to Opus when it can't put the source codec in the file, and
 * it refuses AAC outright in browsers with no AAC encoder — Firefox — even for a
 * straight packet copy. Opus inside an MP4 plays as silence in Safari, QuickTime,
 * iOS and most editors, so the file looks fine in the browser that made it and
 * arrives at everyone else with the audio gone. Every MP4/MOV tool has to register
 * the WASM AAC encoder and name AAC explicitly to avoid that.
 */

/** Audio codecs an MP4/MOV can hold that players actually decode. */
const PLAYABLE = ["aac", "mp3"];

type Probe = { hasAudio: boolean; codec: string | null; rate: number; rms: number | null; err?: string };

async function runTool(page: Page, fixture: string, tool: string, arg?: unknown): Promise<Probe> {
	const bytes = toBytes(readFileSync(fixture));
	return page.evaluate(
		async ({ b, tool, arg }) => {
			const file = new File([new Uint8Array(b)], "clip.mp4", { type: "video/mp4" });
			// @ts-expect-error -- dev-server module path
			const { createInput } = await import("/src/lib/video/utils.ts");

			const call = async (): Promise<{ blob: Blob }> => {
				switch (tool) {
					case "rotate": {
						// @ts-expect-error -- dev-server module path
						const { rotateVideo } = await import("/src/lib/video/rotate.ts");
						return rotateVideo(file, 90);
					}
					case "resize": {
						// @ts-expect-error -- dev-server module path
						const { resizeVideo } = await import("/src/lib/video/resize.ts");
						return resizeVideo(file, { height: 180 });
					}
					case "crop": {
						// @ts-expect-error -- dev-server module path
						const { cropVideo } = await import("/src/lib/video/crop.ts");
						return cropVideo(file, { left: 0, top: 0, width: 160, height: 120 });
					}
					case "trim": {
						// @ts-expect-error -- dev-server module path
						const { trimVideo } = await import("/src/lib/video/trim.ts");
						return trimVideo(file, { start: 0, end: 2 });
					}
					case "convert": {
						// @ts-expect-error -- dev-server module path
						const { convertVideo } = await import("/src/lib/video/convert.ts");
						return convertVideo(file, arg as "mp4" | "mov");
					}
					case "compress": {
						// @ts-expect-error -- dev-server module path
						const { compressVideo } = await import("/src/lib/video/compress.ts");
						return compressVideo(file, { quality: "medium" });
					}
					case "speed": {
						// @ts-expect-error -- dev-server module path
						const { changeVideoSpeed } = await import("/src/lib/video/speed.ts");
						return changeVideoSpeed(file, { speed: 2 });
					}
					default:
						throw new Error(`unknown tool ${tool}`);
				}
			};

			let blob: Blob;
			try {
				blob = (await call()).blob;
			} catch (e) {
				return { hasAudio: false, codec: null, rate: 0, rms: null, err: String(e) };
			}

			const input = await createInput(new File([blob], "out.mp4", { type: "video/mp4" }));
			const audio = await input.getPrimaryAudioTrack();
			const probe = {
				hasAudio: !!audio,
				codec: audio?.codec ?? null,
				rate: audio?.sampleRate ?? 0,
				rms: null as number | null,
			};
			input[Symbol.dispose]();

			// Decoded loudness, so a track that exists but is silent still fails.
			try {
				const ctx = new AudioContext();
				const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
				const d = buf.getChannelData(0);
				let sum = 0;
				for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
				probe.rms = Math.sqrt(sum / d.length);
				ctx.close();
			} catch {
				// Leave rms null — the browser running the test may not decode its own output.
			}
			return probe;
		},
		{ b: bytes, tool, arg },
	);
}

const TOOLS: [name: string, tool: string, arg?: unknown][] = [
	["rotate", "rotate"],
	["resize", "resize"],
	["crop", "crop"],
	["trim", "trim"],
	["convert to mp4", "convert", "mp4"],
	["convert to mov", "convert", "mov"],
	["compress", "compress"],
	["speed", "speed"],
];

for (const [label, tool, arg] of TOOLS) {
	test(`${label} keeps playable audio for AAC-LC input`, async ({ page }) => {
		await page.goto("/video/rotate", { waitUntil: "domcontentloaded" });
		const probe = await runTool(page, mp4WithAudio("codec-lc.mp4"), tool, arg);
		expect(probe.err).toBeUndefined();
		expect(probe.hasAudio).toBe(true);
		expect(PLAYABLE).toContain(probe.codec);
		if (probe.rms !== null) expect(probe.rms).toBeGreaterThan(0.01);
	});

	test(`${label} keeps playable audio for HE-AAC input`, async ({ page }) => {
		test.skip(!hasHeAacEncoder(), "needs ffmpeg's aac_at encoder to build an HE-AAC fixture");
		await page.goto("/video/rotate", { waitUntil: "domcontentloaded" });
		const probe = await runTool(page, mp4HeAac("codec-he.mp4"), tool, arg);
		expect(probe.err).toBeUndefined();
		expect(probe.hasAudio).toBe(true);
		expect(PLAYABLE).toContain(probe.codec);
		if (probe.rms !== null) expect(probe.rms).toBeGreaterThan(0.01);
	});
}

// ─── the fix must stay free on browsers that don't need it ───────────────────

/** Vite serves the WASM encoder under a path containing its package name. */
async function aacEncoderLoads(page: Page, fixture: string) {
	const hits: string[] = [];
	page.on("request", (r) => {
		if (r.url().includes("aac-encoder")) hits.push(r.url());
	});
	await runTool(page, fixture, "rotate");
	return hits.length > 0;
}

test("loads the WASM AAC encoder only where the browser has no native one", async ({ page }) => {
	await page.goto("/video/rotate", { waitUntil: "domcontentloaded" });
	// Asked of WebCodecs directly rather than through Mediabunny, so the page doesn't
	// end up with two copies of the library loaded.
	const native = await page.evaluate(async () => {
		if (!("AudioEncoder" in globalThis)) return false;
		const support = await AudioEncoder.isConfigSupported({
			codec: "mp4a.40.2",
			numberOfChannels: 2,
			sampleRate: 48000,
			bitrate: 128_000,
		});
		return !!support.supported;
	});
	const loaded = await aacEncoderLoads(page, mp4WithAudio("codec-lc.mp4"));
	// Chrome encodes AAC itself, so it must never pull in the 2s WASM fallback.
	expect(loaded).toBe(!native);
});

test("never loads the WASM AAC encoder for a video with no audio", async ({ page }) => {
	await page.goto("/video/rotate", { waitUntil: "domcontentloaded" });
	expect(await aacEncoderLoads(page, mp4NoAudio("codec-silent.mp4"))).toBe(false);
});

test("leaves a silent video alone", async ({ page }) => {
	await page.goto("/video/rotate", { waitUntil: "domcontentloaded" });
	const probe = await runTool(page, mp4NoAudio("codec-silent.mp4"), "rotate");
	expect(probe.err).toBeUndefined();
	expect(probe.hasAudio).toBe(false);
});

import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { hasFfmpeg, mp4Quadrants, mp4RedThenBlue, pngOverlay, wavTone } from "./helpers/fixtures";
import { toBytes } from "./helpers/run-in-page";

/**
 * The video editor's render pipeline, judged by the file that comes out.
 *
 * Preview and export share one compositor, so these build projects in the page,
 * export them for real and read pixels and samples back out of the MP4: the
 * four-colour quadrant fixture says exactly how a frame was flipped, turned,
 * cropped or placed. The last test drives the actual UI, because "I can't drag
 * the image to resize it" is a bug no model test would ever have caught.
 */

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

const QUAD = () => mp4Quadrants("editor-quad.mp4", 4);

async function onEditor(page: Page) {
	await page.goto("/video/editor", { waitUntil: "domcontentloaded" });
	await installHelpers(page);
}

/** Helpers that live in the page: import media, export, and read the result back. */
async function installHelpers(page: Page) {
	await page.evaluate(() => {
		const w = window as unknown as Record<string, unknown>;
		w.__ed = {
			async load(files: { name: string; type: string; bytes: number[] }[]) {
				// @ts-expect-error -- dev-server module path
				const { importMedia } = await import("/src/lib/video/editor/media.ts");
				const out: Record<string, unknown> = {};
				for (const f of files) out[f.name] = await importMedia(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
				return out;
			},
			async render(project: unknown, items: Record<string, { id: string }>) {
				// @ts-expect-error -- dev-server module path
				const { exportProject } = await import("/src/lib/video/editor/export.ts");
				const media = new Map(Object.values(items).map((m) => [m.id, m]));
				const res = await exportProject(project, media, { format: "mp4", resolution: Number.POSITIVE_INFINITY, quality: "high" });
				return URL.createObjectURL(res.blob);
			},
			/** RGB at fractional frame positions, at each time. */
			async pixels(url: string, times: number[], points: [number, number][]) {
				const v = document.createElement("video");
				v.muted = true;
				v.src = url;
				await new Promise((r) => v.addEventListener("loadeddata", r, { once: true }));
				const c = document.createElement("canvas");
				c.width = v.videoWidth;
				c.height = v.videoHeight;
				const ctx = c.getContext("2d", { willReadFrequently: true })!;
				const out: number[][][] = [];
				for (const t of times) {
					v.currentTime = t;
					await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
					ctx.drawImage(v, 0, 0);
					out.push(points.map(([x, y]) => [...ctx.getImageData(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1).data.slice(0, 3)]));
				}
				return { frames: out, duration: v.duration };
			},
			/** Decoded audio of a result, channel 0, as a plain array plus its rate. */
			async audio(url: string) {
				const buf = await (await fetch(url)).arrayBuffer();
				const ctx = new OfflineAudioContext(1, 1, 48000);
				const audio = await ctx.decodeAudioData(buf);
				return { rate: audio.sampleRate, data: Array.from(audio.getChannelData(0)) };
			},
		};
	});
}

const fileArg = (path: string, name: string, type: string) => ({ name, type, bytes: toBytes(readFileSync(path)) });

/** Which of red/lime/blue/white/black/orange a pixel is closest to. */
function colourOf([r, g, b]: number[]) {
	const named: Record<string, number[]> = {
		red: [255, 0, 0],
		lime: [0, 255, 0],
		blue: [0, 0, 255],
		white: [255, 255, 255],
		black: [0, 0, 0],
		orange: [255, 165, 0],
	};
	let best = "";
	let dist = Number.POSITIVE_INFINITY;
	for (const [n, [R, G, B]] of Object.entries(named)) {
		const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
		if (d < dist) {
			dist = d;
			best = n;
		}
	}
	return best;
}

/** Amplitude of one frequency in a stretch of samples (Goertzel). */
function toneLevel(data: number[], rate: number, hz: number, from: number, to: number) {
	const a = Math.floor(from * rate);
	const b = Math.floor(to * rate);
	const k = (2 * Math.PI * hz) / rate;
	let s1 = 0;
	let s2 = 0;
	for (let i = a; i < b; i++) {
		const s = data[i] + 2 * Math.cos(k) * s1 - s2;
		s2 = s1;
		s1 = s;
	}
	return Math.sqrt(s1 * s1 + s2 * s2 - 2 * Math.cos(k) * s1 * s2) / ((b - a) / 2);
}

/** Dominant frequency from zero crossings, good enough for a pure tone. */
function pitchOf(data: number[], rate: number, from: number, to: number) {
	let crossings = 0;
	for (let i = Math.floor(from * rate) + 1; i < Math.floor(to * rate); i++) if (data[i - 1] < 0 !== data[i] < 0) crossings++;
	return crossings / 2 / (to - from);
}

test.describe("video editor export", () => {
	test.setTimeout(120_000);

	test("flip, rotation, crop and placement land where the model says", async ({ page }) => {
		await onEditor(page);
		const result = await page.evaluate(async (file) => {
			const ed = (window as any).__ed;
			// @ts-expect-error -- dev-server module path
			const m = await import("/src/lib/video/editor/model.ts");
			const items = await ed.load([file]);
			const q = items["quad.mp4"];
			const p = m.createProject();
			p.width = 320;
			p.height = 240;
			const track = p.tracks.find((t: { kind: string }) => t.kind === "video").id;
			const at = (id: string, start: number, extra: object) =>
				m.newMediaClip({ id, trackId: track, mediaId: q.id, start, duration: 1, ...extra });
			p.clips = [
				at("flip", 0, { flipH: true }),
				at("rot", 1, { rotation: 180 }),
				at("crop", 2, { crop: { left: 0.5, top: 0, right: 0, bottom: 0 } }),
				at("small", 3, { scale: 0.5, x: 0.25, y: 0.25 }),
			];
			const url = await ed.render(p, items);
			return ed.pixels(url, [0.5, 1.5, 2.5, 3.5], [
				[0.25, 0.25],
				[0.75, 0.25],
				[0.25, 0.75],
				[0.75, 0.75],
				[0.125, 0.125],
			]);
		}, fileArg(QUAD(), "quad.mp4", "video/mp4"));
		const [flip, rot, crop, small] = result.frames.map((f: number[][]) => f.map(colourOf));
		// Source: red lime / blue white.
		expect(flip.slice(0, 4)).toEqual(["lime", "red", "white", "blue"]);
		expect(rot.slice(0, 4)).toEqual(["white", "blue", "lime", "red"]);
		expect(crop.slice(0, 4)).toEqual(["black", "lime", "black", "white"]);
		expect(small[4]).toBe("red");
		expect(small[3]).toBe("black");
	});

	test("speed halves the clip and keeps the pitch", async ({ page }) => {
		await onEditor(page);
		const res = await page.evaluate(async (file) => {
			const ed = (window as any).__ed;
			// @ts-expect-error -- dev-server module path
			const m = await import("/src/lib/video/editor/model.ts");
			const items = await ed.load([file]);
			const q = items["quad.mp4"];
			const p = m.createProject();
			const track = p.tracks.find((t: { kind: string }) => t.kind === "video").id;
			p.clips = [m.newMediaClip({ id: "a", trackId: track, mediaId: q.id, start: 0, duration: 4 })];
			const fast = m.setSpeed(p, "a", 2, new Map([[q.id, q]]));
			const url = await ed.render(fast, items);
			const audio = await ed.audio(url);
			return { clip: fast.clips[0].duration, ...audio, video: (await ed.pixels(url, [0.1], [[0.25, 0.25]])).duration };
		}, fileArg(QUAD(), "quad.mp4", "video/mp4"));
		expect(res.clip).toBeCloseTo(2, 2);
		expect(res.video).toBeGreaterThan(1.9);
		expect(res.video).toBeLessThan(2.2);
		// The fixture is a 440 Hz sine; resampling at 2x would put it near 880.
		expect(pitchOf(res.data, res.rate, 0.3, 1.7)).toBeGreaterThan(420);
		expect(pitchOf(res.data, res.rate, 0.3, 1.7)).toBeLessThan(460);
	});

	test("opacity keyframes animate, and a crossfade blends across the cut", async ({ page }) => {
		await onEditor(page);
		const result = await page.evaluate(async (file) => {
			const ed = (window as any).__ed;
			// @ts-expect-error -- dev-server module path
			const m = await import("/src/lib/video/editor/model.ts");
			const items = await ed.load([file]);
			const q = items["quad.mp4"];
			const p = m.createProject();
			p.width = 320;
			p.height = 240;
			const track = p.tracks.find((t: { kind: string }) => t.kind === "video").id;
			p.clips = [
				m.newMediaClip({
					id: "a",
					trackId: track,
					mediaId: q.id,
					start: 0,
					duration: 2,
					keyframes: { opacity: [{ t: 0, v: 0 }, { t: 1, v: 1 }] },
				}),
				// Turned over, so its top-left is white where the first clip's is red.
				m.newMediaClip({ id: "b", trackId: track, mediaId: q.id, start: 2, duration: 2, rotation: 180, transition: { kind: "crossfade", duration: 1 } }),
			];
			const url = await ed.render(p, items);
			return ed.pixels(url, [0.02, 0.5, 1.2, 2.0, 3.6], [[0.25, 0.25]]);
		}, fileArg(QUAD(), "quad.mp4", "video/mp4"));
		const tl = result.frames.map((f: number[][]) => f[0]);
		expect(colourOf(tl[0])).toBe("black");
		expect(tl[1][0]).toBeGreaterThan(80); // part way up
		expect(tl[1][0]).toBeLessThan(200);
		expect(colourOf(tl[2])).toBe("red");
		// Halfway through red → white: full red, half green and blue.
		expect(tl[3][0]).toBeGreaterThan(220);
		expect(tl[3][1]).toBeGreaterThan(80);
		expect(tl[3][1]).toBeLessThan(180);
		expect(colourOf(tl[4])).toBe("white");
	});

	test("ducking pulls the music down while the voice plays, then lets it back", async ({ page }) => {
		await onEditor(page);
		const res = await page.evaluate(
			async ({ music, voice }) => {
				const ed = (window as any).__ed;
				// @ts-expect-error -- dev-server module path
				const m = await import("/src/lib/video/editor/model.ts");
				const items = await ed.load([music, voice]);
				const p = m.createProject();
				const [a1, a2] = p.tracks.filter((t: { kind: string }) => t.kind === "audio").map((t: { id: string }) => t.id);
				p.clips = [
					m.newMediaClip({ id: "music", trackId: a1, mediaId: items["music.wav"].id, start: 0, duration: 4, duck: true }),
					m.newMediaClip({ id: "voice", trackId: a2, mediaId: items["voice.wav"].id, start: 0, duration: 4 }),
				];
				return ed.audio(await ed.render(p, items));
			},
			{
				music: fileArg(wavTone("editor-music.wav", 220, 4), "music.wav", "audio/wav"),
				voice: fileArg(wavTone("editor-voice.wav", 880, 4, 1, 2.2), "voice.wav", "audio/wav"),
			},
		);
		const before = toneLevel(res.data, res.rate, 220, 0.3, 0.8);
		const during = toneLevel(res.data, res.rate, 220, 1.5, 2.0);
		const after = toneLevel(res.data, res.rate, 220, 3.4, 3.9);
		expect(during / before).toBeLessThan(0.4);
		expect(after / before).toBeGreaterThan(0.85);
	});

	test("reverse plays the range backwards", async ({ page }) => {
		await onEditor(page);
		const res = await page.evaluate(async (file) => {
			const ed = (window as any).__ed;
			// @ts-expect-error -- dev-server module path
			const { reverseRange } = await import("/src/lib/video/editor/reverse.ts");
			const items = await ed.load([file]);
			const out = await reverseRange(items["rb.mp4"], 0, 2);
			return ed.pixels(URL.createObjectURL(out), [0.2, 1.8], [[0.5, 0.5]]);
		}, fileArg(mp4RedThenBlue("editor-red-blue.mp4"), "rb.mp4", "video/mp4"));
		expect(res.frames.map((f: number[][]) => colourOf(f[0]))).toEqual(["blue", "red"]);
		expect(res.duration).toBeGreaterThan(1.8);
		expect(res.duration).toBeLessThan(2.2);
	});
});

test.describe("video editor preview", () => {
	test.setTimeout(90_000);

	test("an image overlay can be resized by its corner and moved in the preview", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/video/editor", { waitUntil: "domcontentloaded" });
		const chooser = page.waitForEvent("filechooser");
		await page.locator(".dropzone").first().click();
		await (await chooser).setFiles([QUAD(), pngOverlay("editor-overlay.png")]);
		await expect(page.locator("[draggable=true]")).toHaveCount(2, { timeout: 20_000 });

		// The video on Video 1, then the image dragged onto Video 2 above it, the way people do it.
		await page.locator("[draggable=true]").nth(0).hover();
		await page.locator('button[title="Add at playhead"]').nth(0).click();
		await page
			.locator("[draggable=true]")
			.nth(1)
			.dragTo(page.locator("[data-track-id]").nth(1), { targetPosition: { x: 4, y: 20 } });
		const imageClip = page.locator("[data-clip-id]").filter({ hasText: "editor-overlay.png" });
		await expect(imageClip).toHaveCount(1);
		// Park the playhead where both are on screen.
		await page.locator(".sticky.top-0.z-30.cursor-pointer").click({ position: { x: 40, y: 10 } });

		const box = (await page.locator("canvas").boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await page.mouse.click(cx, cy);
		await expect(page.getByRole("slider", { name: "Scale" })).toHaveValue("1");

		// The image fits the frame width, so its corner is the frame's corner (a 2:1 picture in 4:3).
		const imgH = box.width / 2;
		const corner = { x: box.x + box.width - 1, y: cy + imgH / 2 - 1 };
		await page.mouse.move(corner.x, corner.y);
		await page.mouse.down();
		await page.mouse.move(cx + box.width / 8, cy + imgH / 8, { steps: 4 });
		await page.mouse.up();
		const scale = Number(await page.getByRole("slider", { name: "Scale" }).inputValue());
		expect(scale).toBeGreaterThan(0.45);
		expect(scale).toBeLessThan(0.75);

		// Drag the body somewhere else.
		const x0 = Number(await page.getByRole("slider", { name: "X" }).inputValue());
		await page.mouse.move(box.x + box.width * 0.2, cy - imgH * 0.3);
		await page.mouse.move(box.x + box.width * 0.2 + 5, cy - imgH * 0.3);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.1, cy - imgH * 0.3, { steps: 4 });
		await page.mouse.up();
		expect(Number(await page.getByRole("slider", { name: "X" }).inputValue())).toBeLessThan(x0 - 0.05);
	});
});

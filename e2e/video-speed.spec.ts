import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
	hasFfmpeg,
	mp4Long,
	mp4MonoAudio,
	mp4NegativeStart,
	mp4NoAudio,
	mp4Rotated,
	mp4UnsupportedCodec,
	mp4Vfr,
	mp4WithAudio,
	webmVp8,
} from "./helpers/fixtures";
import { toBytes, type Outcome } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

/** Puts the page on the app origin so Vite will serve /src/* to page.evaluate. */
async function onApp(page: Page, route = "/video/speed") {
	await page.goto(route, { waitUntil: "domcontentloaded" });
}

/**
 * Runs changeVideoSpeed in the page and probes the result by demuxing it again,
 * so the assertions are about the file that actually comes out, not about what
 * the library claims it did.
 */
async function speedUp(page: Page, fixture: string, speed: number, filename = "clip.mp4"): Promise<Outcome> {
	const bytes = toBytes(readFileSync(fixture));
	return page.evaluate(
		async ({ b, speed, filename }) => {
			const file = new File([new Uint8Array(b)], filename, { type: "video/mp4" });
			try {
				// @ts-expect-error -- dev-server module path
				const { changeVideoSpeed } = await import("/src/lib/video/speed.ts");
				// @ts-expect-error -- dev-server module path
				const { createInput } = await import("/src/lib/video/utils.ts");

				const progress: number[] = [];
				const out = await changeVideoSpeed(file, { speed }, (p: number) => progress.push(p));

				const probeIn = await createInput(file);
				const inDuration = await probeIn.computeDuration();
				const inVideo = await probeIn.getPrimaryVideoTrack();
				const inAudio = await probeIn.getPrimaryAudioTrack();
				const inVideoDuration = inVideo ? await inVideo.computeDuration() : 0;
				const inVideoPackets = inVideo ? (await inVideo.computePacketStats()).packetCount : 0;
				const inAudioDuration = inAudio ? await inAudio.computeDuration() : 0;
				const inCodec = inVideo?.codec ?? null;
				const inRotation = inVideo?.rotation ?? 0;
				const inWidth = inVideo?.displayWidth ?? 0;
				const inHeight = inVideo?.displayHeight ?? 0;
				probeIn[Symbol.dispose]();

				const outFile = new File([out.blob], out.filename, { type: "video/mp4" });
				const probeOut = await createInput(outFile);
				const video = await probeOut.getPrimaryVideoTrack();
				const audio = await probeOut.getPrimaryAudioTrack();
				const result = {
					ok: true as const,
					name: out.filename,
					size: out.blob.size,
					progress,
					inDuration,
					inVideoDuration,
					inVideoPackets,
					inAudioDuration,
					inCodec,
					inRotation,
					inWidth,
					inHeight,
					duration: await probeOut.computeDuration(),
					videoDuration: video ? await video.computeDuration() : 0,
					videoPackets: video ? (await video.computePacketStats()).packetCount : 0,
					codec: video?.codec ?? null,
					width: video?.displayWidth ?? 0,
					height: video?.displayHeight ?? 0,
					rotation: video?.rotation ?? 0,
					hasAudio: !!audio,
					audioDuration: audio ? await audio.computeDuration() : 0,
					audioChannels: audio?.numberOfChannels ?? 0,
					audioSampleRate: audio?.sampleRate ?? 0,
				};
				probeOut[Symbol.dispose]();
				return result;
			} catch (e) {
				return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
			}
		},
		{ b: bytes, speed, filename },
	);
}

/** Calls changeVideoSpeed with an invalid speed and returns the rejection. */
async function expectRejected(page: Page, speed: number) {
	const bytes = toBytes(readFileSync(mp4WithAudio("speed_valid.mp4")));
	const r: Outcome = await page.evaluate(
		async ({ b, speed }) => {
			const file = new File([new Uint8Array(b)], "clip.mp4", { type: "video/mp4" });
			try {
				// @ts-expect-error -- dev-server module path
				const { changeVideoSpeed } = await import("/src/lib/video/speed.ts");
				const out = await changeVideoSpeed(file, { speed });
				return { ok: true as const, size: out.blob.size };
			} catch (e) {
				return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
			}
		},
		{ b: bytes, speed },
	);
	expect(r.ok, `speed ${speed} should have been rejected`).toBe(false);
	return r.ok === false ? r.error : "";
}

// ─── input validation ────────────────────────────────────────────────────────

test.describe("video speed validation", () => {
	test("rejects zero, negative and non-finite speeds", async ({ page }) => {
		await onApp(page);
		for (const speed of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(await expectRejected(page, speed)).toMatch(/greater than 0|between/i);
		}
	});

	test("rejects speeds outside the supported range", async ({ page }) => {
		await onApp(page);
		expect(await expectRejected(page, 8)).toMatch(/between 0\.25x and 4x/i);
		expect(await expectRejected(page, 0.1)).toMatch(/between 0\.25x and 4x/i);
	});
});

/**
 * Audio is re-encoded to AAC, whose frames hold 1024 samples each, so the track
 * lands on the next whole frame plus the encoder's priming — padding at the tail,
 * not drift. How long that is in seconds depends on the sample rate (21ms per
 * frame at 48kHz, 46ms at 22.05kHz), so the tolerance is derived from the rate
 * the output actually used. Video timings are exact and are asserted as such.
 */
const audioSlack = (sampleRate: number) => (5 * 1024) / sampleRate;

// ─── the actual re-timing ────────────────────────────────────────────────────

test.describe("video speed conversion", () => {
	test("2x halves the duration and keeps both tracks", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4WithAudio("speed_2x.mp4", 48000, 4), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.inDuration as number).toBeGreaterThan(3.5);
		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 2, 2);

		expect(r.hasAudio).toBe(true);
		expect(Math.abs((r.audioDuration as number) - (r.inAudioDuration as number) / 2)).toBeLessThan(audioSlack(r.audioSampleRate as number));
		expect(r.name).toBe("clip_2x.mp4");
		expect(r.size as number).toBeGreaterThan(0);
	});

	test("0.5x doubles the duration", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4WithAudio("speed_half.mp4", 48000, 2), 0.5);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 0.5, 2);
		expect(r.hasAudio).toBe(true);
		expect(Math.abs((r.audioDuration as number) - (r.inAudioDuration as number) / 0.5)).toBeLessThan(audioSlack(r.audioSampleRate as number));
		expect(r.name).toBe("clip_0.5x.mp4");
	});

	test("a fractional speed re-times audio and video by the same factor", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4WithAudio("speed_1_5x.mp4", 44100, 3), 1.5);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 1.5, 2);
		// Video and audio must stay in sync — a resampler that drops or duplicates
		// frames at chunk boundaries shows up here as drift.
		expect(Math.abs((r.videoDuration as number) - (r.audioDuration as number))).toBeLessThan(audioSlack(r.audioSampleRate as number));
		// Sample rate is preserved; only the frame count changes.
		expect(r.audioSampleRate).toBe(44100);
		expect(r.audioChannels).toBe(2);
	});

	test("audio is genuinely resampled: pitch scales and the tone stays unbroken", async ({ page }) => {
		await onApp(page);
		const bytes = toBytes(readFileSync(mp4WithAudio("speed_tone.mp4", 48000, 4)));

		const r: Outcome = await page.evaluate(async (b) => {
			const file = new File([new Uint8Array(b)], "clip.mp4", { type: "video/mp4" });
			try {
				// @ts-expect-error -- dev-server module path
				const { changeVideoSpeed } = await import("/src/lib/video/speed.ts");

				// Decoded with the Web Audio API — a decoder independent of the one
				// that wrote the file, so this checks the bytes, not the library's bookkeeping.
				const ctx = new AudioContext({ sampleRate: 48000 });
				const analyse = async (blob: Blob) => {
					const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
					const pcm = buf.getChannelData(0);
					// Zero-crossing rate over the body of the tone → dominant frequency.
					const from = Math.floor(buf.sampleRate * 0.3);
					const to = Math.floor(pcm.length - buf.sampleRate * 0.3);
					let crossings = 0;
					let quietest = Number.POSITIVE_INFINITY;
					for (let i = from + 1; i < to; i++) {
						if (pcm[i - 1] < 0 !== pcm[i] < 0) crossings++;
					}
					// A dropout at a resampler chunk boundary would show as a near-silent
					// window; the source is a continuous sine, so every window has energy.
					const win = 1024;
					for (let start = from; start + win < to; start += win) {
						let peak = 0;
						for (let i = start; i < start + win; i++) peak = Math.max(peak, Math.abs(pcm[i]));
						quietest = Math.min(quietest, peak);
					}
					return {
						freq: (crossings / 2) * (buf.sampleRate / (to - from)),
						quietest,
						duration: buf.duration,
					};
				};

				const source = await analyse(file);
				const fast = await analyse((await changeVideoSpeed(file, { speed: 2 })).blob);
				const slow = await analyse((await changeVideoSpeed(file, { speed: 0.5 })).blob);
				await ctx.close();
				return { ok: true as const, source, fast, slow };
			} catch (e) {
				return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
			}
		}, bytes);

		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		const source = r.source as { freq: number; quietest: number; duration: number };
		const fast = r.fast as { freq: number; quietest: number; duration: number };
		const slow = r.slow as { freq: number; quietest: number; duration: number };

		// The fixture is a 440Hz sine.
		expect(source.freq).toBeGreaterThan(420);
		expect(source.freq).toBeLessThan(460);

		// Resampling shifts pitch with speed, the way a tape does.
		expect(fast.freq / source.freq).toBeCloseTo(2, 1);
		expect(slow.freq / source.freq).toBeCloseTo(0.5, 1);

		// No dropouts anywhere in either output: every window keeps close to the
		// source's own level (ffmpeg's sine peaks around 0.09, so this is relative).
		expect(source.quietest).toBeGreaterThan(0.05);
		expect(fast.quietest).toBeGreaterThan(source.quietest * 0.7);
		expect(slow.quietest).toBeGreaterThan(source.quietest * 0.7);

		// And the tone spans the whole re-timed clip.
		expect(fast.duration).toBeGreaterThan(1.9);
		expect(slow.duration).toBeGreaterThan(7.9);
	});

	test("the extremes of the range hold up: 4x and 0.25x", async ({ page }) => {
		await onApp(page);

		const fast = await speedUp(page, mp4WithAudio("speed_4x.mp4", 48000, 4), 4);
		expect(fast.ok, fast.ok ? "" : fast.error).toBe(true);
		if (!fast.ok) return;
		expect(fast.videoDuration as number).toBeCloseTo((fast.inVideoDuration as number) / 4, 1);
		expect(Math.abs((fast.videoDuration as number) - (fast.audioDuration as number))).toBeLessThan(
			audioSlack(fast.audioSampleRate as number),
		);
		expect(fast.name).toBe("clip_4x.mp4");

		const slow = await speedUp(page, mp4WithAudio("speed_quarter.mp4", 48000, 2), 0.25);
		expect(slow.ok, slow.ok ? "" : slow.error).toBe(true);
		if (!slow.ok) return;
		expect(slow.videoDuration as number).toBeCloseTo((slow.inVideoDuration as number) / 0.25, 1);
		expect(Math.abs((slow.videoDuration as number) - (slow.audioDuration as number))).toBeLessThan(
			audioSlack(slow.audioSampleRate as number),
		);
		expect(slow.name).toBe("clip_0.25x.mp4");
	});

	test("variable frame rate footage keeps its uneven timing", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4Vfr("speed_vfr.mp4", 4), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		// Frame durations vary across this clip, so a tool that assumed a constant
		// frame rate would stretch the slow section and squash the fast one.
		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 2, 1);
		expect(Math.abs((r.videoDuration as number) - (r.audioDuration as number))).toBeLessThan(audioSlack(r.audioSampleRate as number));
	});

	test("a 30s clip finishes in sync — no drift accumulating down the file", async ({ page }) => {
		test.setTimeout(180_000);
		await onApp(page);
		const r = await speedUp(page, mp4Long("speed_long.mp4", 30), 1.5);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		// The tolerance here is the same as the 2s cases: any per-block rounding
		// error in the resampler would have compounded 15x over this clip.
		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 1.5, 1);
		expect(Math.abs((r.videoDuration as number) - (r.audioDuration as number))).toBeLessThan(audioSlack(r.audioSampleRate as number));
	});

	test("a real GoPro .lrv file from the repo works", async ({ page }) => {
		await onApp(page);
		// Mono 44.1kHz AAC in an MP4 wearing a .lrv extension — a real file, not a fixture.
		const r = await speedUp(page, "test-assets/test_clip.lrv", 2, "test_clip.lrv");
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.codec).toBe("avc");
		expect(r.audioChannels).toBe(1);
		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 2, 1);
		expect(r.name).toBe("test_clip_2x.mp4");
	});

	test("timescale rounding noise doesn't get mistaken for pre-roll", async ({ page }) => {
		await onApp(page);
		const verdicts = await page.evaluate(async () => {
			// @ts-expect-error -- dev-server module path
			const { canCopyPacketsThrough } = await import("/src/lib/video/speed.ts");
			return {
				zero: canCopyPacketsThrough(0),
				// The real value an ordinary 1080p H.264 file reported: a third of a
				// microsecond below zero, purely from the container's timescale. Reading
				// that as pre-roll sent an 11-minute file down the decode path — 93s and
				// 255MB, against 3s and 100MB for the copy it should have been.
				roundingNoise: canCopyPacketsThrough(-3.3333333333333335e-7),
				subMillisecond: canCopyPacketsThrough(-0.0005),
				oneFrameAt50fps: canCopyPacketsThrough(-0.02),
				screenRecording: canCopyPacketsThrough(-0.95),
			};
		});
		expect(verdicts).toEqual({
			zero: true,
			roundingNoise: true,
			subMillisecond: true,
			oneFrameAt50fps: false,
			screenRecording: false,
		});
	});

	test("a file whose packets start before zero (screen-recording shape) still works", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4NegativeStart("speed_negative_start.mp4", 4), 2);
		// Regression: the raw packet sink hands out the hidden pre-roll at negative
		// timestamps, and the muxer rejects those outright ("Timestamps must be
		// non-negative"). Real macOS screen recordings are all this shape.
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		// The output holds the presented footage only — the same content every other
		// tool in the app produces for this file — at half the length.
		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 2, 1);
		// The fixture is 4s at 15fps whose first second is hidden by an edit list: 60
		// packets in the file, 45 of them presented. Carrying the pre-roll through —
		// or clamping it onto timestamp 0 — shows up here as 60.
		expect(r.inVideoPackets).toBe(60);
		expect(r.videoPackets).toBe(45);
		expect(r.hasAudio).toBe(true);
		expect(Math.abs((r.videoDuration as number) - (r.audioDuration as number))).toBeLessThan(
			audioSlack(r.audioSampleRate as number),
		);
	});

	test("an unreadable codec fails with a message that says so", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4UnsupportedCodec("speed_mp4v.mp4", 2), 2);
		expect(r.ok).toBe(false);
		// Mediabunny throws a bare "Assertion failed." from inside its demuxer for
		// MPEG-4 Part 2; anything surfacing to a user has to be better than that.
		if (!r.ok) {
			expect(r.error).not.toMatch(/^Assertion failed/i);
			expect(r.error).toMatch(/could not read|not supported|unsupported/i);
		}
	});

	test("video is copied through, not re-encoded or rescaled", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4WithAudio("speed_copy.mp4", 48000, 2), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.codec).toBe(r.inCodec);
		expect(r.width).toBe(r.inWidth);
		expect(r.height).toBe(r.inHeight);
	});

	test("a WebM source MP4 can't hold is re-encoded rather than failing", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, webmVp8("speed_vp8.webm", 2), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		// VP8 has no place in MP4, so the copy-through path must have stepped aside.
		expect(r.inCodec).toBe("vp8");
		expect(r.codec).not.toBe("vp8");
		expect(r.width).toBe(r.inWidth);
		expect(r.height).toBe(r.inHeight);
		expect(r.videoDuration as number).toBeCloseTo((r.inVideoDuration as number) / 2, 1);
		expect(r.hasAudio).toBe(true);
	});

	test("mono audio at a non-48k rate keeps its channel count and rate", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4MonoAudio("speed_mono.mp4", 3), 1.25);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.audioChannels).toBe(1);
		// Chrome's AAC encoder rejects 22050 Hz outright, so there the resampler has
		// to land on a higher rate; Firefox and WebKit accept it and keep the source
		// rate. Either is correct — what matters is that the job doesn't fail and the
		// audio stays with the picture.
		expect([22050, 44100, 48000]).toContain(r.audioSampleRate);
		expect(Math.abs((r.videoDuration as number) - (r.audioDuration as number))).toBeLessThan(audioSlack(r.audioSampleRate as number));
	});

	test("rotation metadata survives the copy-through", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4Rotated("speed_rotated.mp4", 2), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.inRotation).not.toBe(0);
		expect(r.rotation).toBe(r.inRotation);
	});

	test("a video with no audio track stays audio-free", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4NoAudio("speed_silent.mp4", 2), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.hasAudio).toBe(false);
		// Nothing to pad the tail here, so the whole file lands on the exact duration.
		expect(r.duration as number).toBeCloseTo((r.inDuration as number) / 2, 2);
	});

	test("speed 1 round-trips without changing the duration", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4WithAudio("speed_one.mp4", 48000, 2), 1);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		expect(r.videoDuration as number).toBeCloseTo(r.inVideoDuration as number, 2);
		expect(Math.abs((r.audioDuration as number) - (r.inAudioDuration as number))).toBeLessThan(audioSlack(r.audioSampleRate as number));
		expect(r.hasAudio).toBe(true);
	});

	test("progress runs forward and finishes at 1", async ({ page }) => {
		await onApp(page);
		const r = await speedUp(page, mp4WithAudio("speed_progress.mp4", 48000, 3), 2);
		expect(r.ok, r.ok ? "" : r.error).toBe(true);
		if (!r.ok) return;

		const progress = r.progress as number[];
		expect(progress.length).toBeGreaterThan(1);
		expect(Math.min(...progress)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...progress)).toBe(1);
		// Monotonic: a bar that jumps backwards reads as a stall to the user.
		for (let i = 1; i < progress.length; i++) {
			expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
		}
	});
});

// ─── the page itself ─────────────────────────────────────────────────────────

test.describe("video speed page", () => {
	test("is listed and reachable from the video tools index", async ({ page }) => {
		await onApp(page, "/video");
		const card = page.locator('a[href="/video/speed"]');
		await expect(card).toBeVisible({ timeout: 30_000 });
		await expect(card).toContainText("Change Speed");
		await card.click();
		await expect(page).toHaveURL(/\/video\/speed$/);
		await expect(page.getByRole("heading", { name: "Change Video Speed" })).toBeVisible();
	});

	test("accepts videos up to the 2GB limit, not the dropzone's 100MB default", async ({ page }) => {
		await onApp(page);
		// Regression: without an explicit maxSize the dropzone falls back to 100MB and
		// turns away ordinary recordings. Every other video route passes this through.
		await expect(page.getByText(/Max 2048MB/)).toBeVisible();
	});

	test("processes a dropped file and shows the result player", async ({ page }) => {
		await onApp(page);

		// The dropzone creates its <input type="file"> on demand, so go through the chooser.
		const chooser = page.waitForEvent("filechooser");
		await page
			.getByText(/drop|choose|browse|select/i)
			.first()
			.click();
		await (await chooser).setFiles(mp4WithAudio("speed_ui.mp4", 48000, 3));

		// Duration preview reflects the selected speed before anything is processed.
		await expect(page.getByText("Original duration:")).toBeVisible({ timeout: 15_000 });
		await page.getByRole("button", { name: "4x", exact: true }).click();
		await expect(page.getByRole("button", { name: /Change Speed to 4x/ })).toBeVisible();

		await page.getByRole("button", { name: "2x", exact: true }).click();
		await page.getByRole("button", { name: /Change Speed to 2x/ }).click();

		const video = page.locator("video").first();
		await expect(video).toBeVisible({ timeout: 60_000 });
		await expect(page.getByText("Speed Changed!")).toBeVisible();

		// The player holds the re-timed file: a 3s source at 2x is ~1.5s.
		const duration = await video.evaluate(
			(v: HTMLVideoElement) =>
				new Promise<number>((resolve) => {
					if (Number.isFinite(v.duration) && v.duration > 0) return resolve(v.duration);
					v.addEventListener("loadedmetadata", () => resolve(v.duration), { once: true });
				}),
		);
		expect(duration).toBeGreaterThan(1.2);
		expect(duration).toBeLessThan(1.9);
	});
});

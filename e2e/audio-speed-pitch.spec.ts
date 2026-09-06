import { expect, test, type Page } from "@playwright/test";
import type { Outcome } from "./helpers/run-in-page";

// The Speed tool used to resample: reading the samples faster shortens the clip but
// multiplies every frequency with it, so a sped-up voice came back a chipmunk — on a
// page whose own copy promised "without pitch change". It time-stretches now, and
// these are the properties that fix has to keep: the pitch, the length, the cost,
// and a page that stays alive while it works.

/** Renders a tone of `seconds` in the page and returns it as WAV bytes. */
async function tone(page: Page, seconds: number) {
	return page.evaluate(async (dur) => {
		const ctx = new OfflineAudioContext(2, Math.round(dur * 44100), 44100);
		const osc = ctx.createOscillator();
		osc.frequency.value = 440;
		const gain = ctx.createGain();
		gain.gain.value = 0.5;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(dur);
		const buf = await ctx.startRendering();
		// @ts-expect-error -- dev-server module path
		const { audioBufferToWav } = await import("/src/lib/audio-utils.ts");
		const blob = await audioBufferToWav(buf);
		return Array.from(new Uint8Array(await blob.arrayBuffer()));
	}, seconds);
}

async function onApp(page: Page, route = "/audio/speed") {
	await page.goto(route, { waitUntil: "domcontentloaded" });
}

test.describe("audio speed", () => {
	// Speeding up used to resample, which multiplies every frequency by the speed —
	// a 440Hz tone came back at 880Hz and voices sounded like chipmunks.
	test("keeps the pitch when speeding up", async ({ page }) => {
		await onApp(page, "/audio/speed");
		const bytes = await tone(page, 2);

		const r: Outcome = await page.evaluate(async (b) => {
			const file = new File([new Uint8Array(b)], "tone.wav", { type: "audio/wav" });
			// Goertzel: how much energy the signal carries at one frequency.
			const magnitude = (x: Float32Array, freq: number, rate: number) => {
				const coeff = 2 * Math.cos((2 * Math.PI * freq) / rate);
				let s1 = 0;
				let s2 = 0;
				for (let i = 0; i < x.length; i++) {
					const s0 = x[i] + coeff * s1 - s2;
					s2 = s1;
					s1 = s0;
				}
				return Math.sqrt(Math.abs(s1 * s1 + s2 * s2 - coeff * s1 * s2)) / x.length;
			};
			try {
				// @ts-expect-error -- dev-server module path
				const { changeSpeed, loadAudioFile } = await import("/src/lib/audio-utils.ts");
				const read = async (blob: Blob) => {
					const buf = await loadAudioFile(new File([blob], "out.wav", { type: "audio/wav" }));
					const data = buf.getChannelData(0);
					return {
						fundamental: magnitude(data, 440, buf.sampleRate),
						octave: magnitude(data, 880, buf.sampleRate),
					};
				};
				return {
					ok: true,
					kept: await read(await changeSpeed(file, 2)),
					tape: await read(await changeSpeed(file, 2, { preservePitch: false })),
				};
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		}, bytes);

		expect(r.ok, !r.ok ? r.error : "").toBe(true);
		if (!r.ok) return;
		const kept = r.kept as { fundamental: number; octave: number };
		const tape = r.tape as { fundamental: number; octave: number };
		// Default: the tone is still a 440Hz tone.
		expect(kept.fundamental).toBeGreaterThan(kept.octave * 10);
		// Unchecked: the tape effect, where 440Hz lands an octave up.
		expect(tape.octave).toBeGreaterThan(tape.fundamental * 10);
	});

	// The stretcher drops input it has passed by copying what's left, so feeding it a
	// whole file in one push made the cost quadratic — fine for a few seconds, minutes
	// of frozen tab for a podcast. Short clips can't tell the two apart; this one can.
	// The tone is built in the page: minutes of WAV are far too big to pass through
	// evaluate. It has to be this long — at 60s the quadratic path still came in under
	// any threshold a slow machine could also meet.
	test("stays fast on a long file", async ({ page }) => {
		await onApp(page, "/audio/speed");

		const r: Outcome = await page.evaluate(async () => {
			try {
				// @ts-expect-error -- dev-server module path
				const { changeSpeed, audioBufferToWav } = await import("/src/lib/audio-utils.ts");
				const ctx = new OfflineAudioContext(2, 120 * 44100, 44100);
				const osc = ctx.createOscillator();
				osc.frequency.value = 440;
				osc.connect(ctx.destination);
				osc.start();
				osc.stop(120);
				const file = new File([await audioBufferToWav(await ctx.startRendering())], "long.wav", { type: "audio/wav" });

				const started = performance.now();
				const blob = await changeSpeed(file, 2);
				return { ok: true, ms: performance.now() - started, size: blob.size };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		});

		expect(r.ok, !r.ok ? r.error : "").toBe(true);
		// The linear path takes ~1s here; the quadratic one took over ten.
		if (r.ok) expect(r.ms as number).toBeLessThan(6000);
	});

	// WSOLA emits whole hops, so the result used to overshoot the requested length by
	// up to a window — the page promised a duration the file didn't have.
	test("lands on the duration the page promises", async ({ page }) => {
		await onApp(page, "/audio/speed");
		const bytes = await tone(page, 2);

		const r: Outcome = await page.evaluate(async (b) => {
			const file = new File([new Uint8Array(b)], "tone.wav", { type: "audio/wav" });
			try {
				// @ts-expect-error -- dev-server module path
				const { changeSpeed, getAudioInfo } = await import("/src/lib/audio-utils.ts");
				const durations: Record<string, number> = {};
				for (const speed of [0.5, 1.5, 2]) {
					const blob = await changeSpeed(file, speed);
					const info = await getAudioInfo(new File([blob], "out.wav", { type: "audio/wav" }));
					durations[String(speed)] = info.duration;
				}
				return { ok: true, durations };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		}, bytes);

		expect(r.ok, !r.ok ? r.error : "").toBe(true);
		if (!r.ok) return;
		const durations = r.durations as Record<string, number>;
		// Within a millisecond of 2s / speed, not the ~1% a stray hop used to add.
		expect(durations["0.5"]).toBeCloseTo(4, 3);
		expect(durations["1.5"]).toBeCloseTo(2 / 1.5, 3);
		expect(durations["2"]).toBeCloseTo(1, 3);
	});

	// The stretch is main-thread number crunching. Without yielding it runs as one
	// unbroken block — nothing repaints, so a progress bar can only appear once the
	// work it was reporting on is already finished. Measured on the stretch alone:
	// decoding and WAV encoding stall the thread too, and would mask the difference.
	test("reports progress and lets the page paint while it stretches", async ({ page }) => {
		await onApp(page, "/audio/speed");

		const r: Outcome = await page.evaluate(async () => {
			try {
				// @ts-expect-error -- dev-server module path
				const { timeStretchPlanes } = await import("/src/lib/audio/time-stretch.ts");
				const frames = 120 * 44100;
				const planes = [new Float32Array(frames), new Float32Array(frames)];
				for (let i = 0; i < frames; i++) {
					planes[0][i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
					planes[1][i] = planes[0][i];
				}

				// Count frames, and the longest gap between them. A frozen thread paints
				// nothing at all, so zero frames is the failure — not a large gap.
				let last = performance.now();
				let maxGap = 0;
				let painted = 0;
				let painting = true;
				const tick = () => {
					const now = performance.now();
					maxGap = Math.max(maxGap, now - last);
					last = now;
					painted++;
					if (painting) requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
				// Let the first frames settle before the clock that matters starts.
				await new Promise((r) => setTimeout(r, 200));
				painted = 0;
				maxGap = 0;

				const reported: number[] = [];
				last = performance.now();
				await timeStretchPlanes(planes, 2, (p: number) => reported.push(p));
				painting = false;
				return { ok: true, maxGap, painted, reported };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		});

		expect(r.ok, !r.ok ? r.error : "").toBe(true);
		if (!r.ok) return;
		const reported = r.reported as number[];
		// One report per yield, so the count tracks the yield interval, not the file.
		expect(reported.length).toBeGreaterThan(2);
		expect([...reported].sort((a, b) => a - b)).toEqual(reported); // never runs backwards
		expect(reported.at(-1)).toBe(1);
		// Blocked, the stretch paints nothing at all; yielding gets frames through at
		// roughly the yield interval.
		expect(r.painted as number).toBeGreaterThan(2);
		expect(r.maxGap as number).toBeLessThan(150);
	});
});

test.describe("audio speed page", () => {
	// The page's own copy has always promised "without pitch change"; until the
	// toggle existed, the tool did the opposite of what the page said.
	test("offers the pitch toggle, on by default", async ({ page }) => {
		await onApp(page, "/audio/speed");
		const bytes = await tone(page, 1);

		const chooser = page.waitForEvent("filechooser");
		await page
			.getByText(/drop|choose|browse|select/i)
			.first()
			.click();
		await (await chooser).setFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: Buffer.from(bytes) });

		const toggle = page.getByRole("checkbox");
		await expect(toggle).toBeVisible({ timeout: 15_000 });
		await expect(toggle).toBeChecked();
		await toggle.uncheck();
		await expect(toggle).not.toBeChecked();
	});
});

test.describe("wav encoding", () => {
	// Every audio tool ends here, writing one sample at a time. Half an hour of stereo
	// is 160 million of them: as a single synchronous run it painted nothing for three
	// and a half seconds, so whatever progress a tool had shown just stopped.
	test("lets the page paint while it encodes", async ({ page }) => {
		await onApp(page, "/audio/speed");

		const r: Outcome = await page.evaluate(async () => {
			try {
				// @ts-expect-error -- dev-server module path
				const { audioBufferToWav } = await import("/src/lib/audio-utils.ts");
				const ctx = new OfflineAudioContext(2, 10 * 60 * 44100, 44100);
				const osc = ctx.createOscillator();
				osc.connect(ctx.destination);
				osc.start();
				osc.stop(10 * 60);
				const buffer = await ctx.startRendering();

				let last = performance.now();
				let maxGap = 0;
				let painted = 0;
				let painting = true;
				const tick = () => {
					const now = performance.now();
					maxGap = Math.max(maxGap, now - last);
					last = now;
					painted++;
					if (painting) requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
				await new Promise((r) => setTimeout(r, 200));
				painted = 0;
				maxGap = 0;
				last = performance.now();

				const reported: number[] = [];
				const blob = await audioBufferToWav(buffer, (p: number) => reported.push(p));
				painting = false;
				return { ok: true, maxGap, painted, reported, size: blob.size };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
		});

		expect(r.ok, !r.ok ? r.error : "").toBe(true);
		if (!r.ok) return;
		// 10 minutes of 16-bit stereo at 44.1kHz, plus the 44-byte header.
		expect(r.size).toBe(10 * 60 * 44100 * 2 * 2 + 44);
		const reported = r.reported as number[];
		expect(reported.length).toBeGreaterThan(2);
		expect([...reported].sort((a, b) => a - b)).toEqual(reported);
		expect(reported.at(-1)).toBe(1);
		expect(r.painted as number).toBeGreaterThan(2);
		expect(r.maxGap as number).toBeLessThan(150);
	});
});

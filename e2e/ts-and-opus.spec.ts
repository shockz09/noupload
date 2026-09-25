import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hasFfmpeg, opusVoiceNote, tsMpeg2, tsWithAudio } from "./helpers/fixtures";
import { toBytes, type Outcome } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build fixtures");

async function pick(page: Page, path: string) {
	const chooser = page.waitForEvent("filechooser");
	await page
		.getByText(/drop|choose|browse|select/i)
		.first()
		.click();
	await (await chooser).setFiles(path);
}

/** Remux a .ts in the page and demux the result, so assertions are about the real file. */
async function remux(page: Page, fixture: string, filename: string): Promise<Outcome> {
	const bytes = toBytes(readFileSync(fixture));
	return page.evaluate(
		async ({ b, filename }) => {
			try {
				// @ts-expect-error -- dev-server module path
				const { remuxTransportStream } = await import("/src/lib/video/transport-stream.ts");
				// @ts-expect-error -- dev-server module path
				const { createInput } = await import("/src/lib/video/utils.ts");
				const out: File = await remuxTransportStream(new File([new Uint8Array(b)], filename));
				const input = await createInput(out);
				const video = await input.getPrimaryVideoTrack();
				const audio = await input.getPrimaryAudioTrack();
				return {
					ok: true as const,
					name: out.name,
					type: out.type,
					format: (await input.getFormat()).name,
					duration: await input.computeDuration(),
					firstVideo: video ? await video.getFirstTimestamp() : null,
					videoCodec: video?.codec ?? null,
					audioCodec: audio?.codec ?? null,
				};
			} catch (err) {
				return { ok: false as const, error: String(err) };
			}
		},
		{ b: bytes, filename },
	);
}

test.describe("MPEG transport stream (.ts) intake", () => {
	test("is rewrapped as an MP4 that starts at zero, video and audio copied", async ({ page }) => {
		await page.goto("/video/convert", { waitUntil: "domcontentloaded" });
		const r = await remux(page, tsWithAudio("clip.ts", 3), "clip.ts");
		expect(r.ok, JSON.stringify(r)).toBe(true);
		if (!r.ok) return;
		expect(r.name).toBe("clip.mp4");
		expect(r.type).toBe("video/mp4");
		expect(r.format).not.toMatch(/transport/i);
		expect(r.videoCodec).toBe("avc");
		expect(r.audioCodec).toBe("aac");
		// The TS clock starts at 1.4s; the MP4 must not carry that offset into durations.
		expect(r.firstVideo as number).toBeLessThan(0.1);
		expect(r.duration as number).toBeGreaterThan(2.8);
		expect(r.duration as number).toBeLessThan(3.3);
	});

	test("MPEG-2 video fails with a message that names the codec", async ({ page }) => {
		await page.goto("/video/convert", { waitUntil: "domcontentloaded" });
		const r = await remux(page, tsMpeg2("tv.ts", 2), "tv.ts");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.error).toMatch(/MPEG-2/);
	});

	test("a video tool takes a .ts from the dropzone and previews it", async ({ page }) => {
		await page.goto("/video/speed", { waitUntil: "domcontentloaded" });
		await pick(page, tsWithAudio("clip.ts", 3));
		await expect(page.getByText("clip.mp4")).toBeVisible({ timeout: 20_000 });
		const preview = page.locator("video").first();
		await expect
			.poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 15_000 })
			.toBe(320);
	});
});

test.describe("Opus voice notes", () => {
	test("the audio tools accept .opus and convert it", async ({ page }) => {
		await page.goto("/audio/convert", { waitUntil: "domcontentloaded" });
		await pick(page, opusVoiceNote("voice-note.opus", 3));
		await expect(page.getByText("voice-note.opus")).toBeVisible({ timeout: 15_000 });
		await page.getByRole("button", { name: /Convert to MP3/ }).click();
		await expect(page.getByText("Conversion Complete!")).toBeVisible({ timeout: 60_000 });
	});
});

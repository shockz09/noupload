import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(__dirname, ".fixtures");

// Audio codecs that show up in real MOV files but that MP4 can't play back:
// PCM variants (twos/sowt/lpcm) plus A-law and µ-law.
const UNPLAYABLE_IN_MP4 = ["pcm_s16be", "pcm_f32le", "pcm_u8", "pcm_alaw", "pcm_mulaw"];

function hasFfmpeg() {
	try {
		execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/** Builds a 3s MOV carrying a 440Hz tone in the given audio codec. Returns its path. */
function makeMov(audioCodec: string) {
	mkdirSync(FIXTURE_DIR, { recursive: true });
	const out = join(FIXTURE_DIR, `${audioCodec}.mov`);
	if (existsSync(out)) return out;
	execFileSync(
		"ffmpeg",
		// prettier-ignore
		[
			"-y",
			"-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=3",
			"-f", "lavfi", "-i", "sine=frequency=440:duration=3",
			"-c:v", "libx264", "-pix_fmt", "yuv420p",
			"-c:a", audioCodec,
			out,
		],
		{ stdio: "ignore" },
	);
	return out;
}

/** Converts a MOV to MP4 in the browser and reports the audio track that came out. */
async function convertAndProbe(page: Page, movPath: string) {
	await page.goto("/video/convert");
	const bytes = Array.from(readFileSync(movPath));

	return page.evaluate(async (data) => {
		const file = new File([new Uint8Array(data)], "in.mov", { type: "video/quicktime" });
		// These specifiers are resolved by the Vite dev server at runtime, not by tsc.
		// @ts-expect-error -- dev-server module path
		const { convertVideo } = await import("/src/lib/video/convert.ts");
		const { blob } = await convertVideo(file, "mp4");

		// @ts-expect-error -- dev-server module path
		const { createInput } = await import("/src/lib/video/utils.ts");
		const input = await createInput(new File([blob], "out.mp4", { type: "video/mp4" }));
		const track = await input.getPrimaryAudioTrack();
		return {
			codec: track?.codec ?? null,
			canDecode: track ? await track.canDecode() : false,
			duration: track ? await track.computeDuration() : 0,
		};
	}, bytes);
}

// ─── Video Convert: MOV → MP4 keeps audio ───────────────────────────────────

test.describe("MOV to MP4 audio", () => {
	test.skip(!hasFfmpeg(), "ffmpeg is required to build the MOV fixtures");

	// MP4 can technically *hold* PCM (via ISO/IEC 23003-5), so a straight packet copy produces a
	// file whose audio no browser or QuickTime can decode — it plays as if the audio were dropped.
	// A-law/µ-law aren't holdable at all and get discarded outright. Both must become AAC.
	for (const audioCodec of UNPLAYABLE_IN_MP4) {
		test(`${audioCodec} source is transcoded to playable AAC`, async ({ page }) => {
			const result = await convertAndProbe(page, makeMov(audioCodec));
			expect(result.codec).toBe("aac");
			expect(result.canDecode).toBe(true);
			expect(result.duration).toBeGreaterThan(2.5);
		});
	}

	test("aac source keeps its audio via the fast copy path", async ({ page }) => {
		const result = await convertAndProbe(page, makeMov("aac"));
		expect(result.codec).toBe("aac");
		expect(result.canDecode).toBe(true);
		expect(result.duration).toBeGreaterThan(2.5);
	});
});

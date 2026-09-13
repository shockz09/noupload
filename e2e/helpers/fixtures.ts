import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * ffmpeg-generated video/audio fixtures, cached on disk between runs.
 * Tests that need these should `test.skip(!hasFfmpeg(), ...)` — ffmpeg is a
 * local dev dependency, not something the repo ships.
 */

const FIXTURE_DIR = join(__dirname, "..", ".fixtures-deep");

export function hasFfmpeg() {
	try {
		execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function cached(name: string, build: (out: string) => void) {
	mkdirSync(FIXTURE_DIR, { recursive: true });
	const out = join(FIXTURE_DIR, name);
	if (!existsSync(out)) build(out);
	return out;
}

function ffmpeg(args: string[]) {
	execFileSync("ffmpeg", ["-y", ...args], { stdio: "ignore" });
}

/** 320x240 testsrc + 440Hz sine, aac audio at the given sample rate. */
export function mp4WithAudio(name: string, sampleRate = 48000, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p",
			"-c:a", "aac", "-ar", String(sampleRate), "-ac", "2",
			"-shortest", out,
		]),
	);
}

/** Same video, no audio track at all. */
export function mp4NoAudio(name: string, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", out,
		]),
	);
}

/**
 * Four solid colour quadrants — red, green, blue, white clockwise from top-left —
 * with the usual 440Hz sine over the top.
 *
 * Every quadrant is a different colour, so reading four pixels out of a decoded
 * frame says exactly which way the picture was turned or reflected. A `testsrc`
 * pattern can't do that: it looks near enough the same mirrored.
 */
export function mp4Quadrants(name: string, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `color=c=red:s=160x120:r=15:d=${duration}`,
			"-f", "lavfi", "-i", `color=c=lime:s=160x120:r=15:d=${duration}`,
			"-f", "lavfi", "-i", `color=c=blue:s=160x120:r=15:d=${duration}`,
			"-f", "lavfi", "-i", `color=c=white:s=160x120:r=15:d=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-filter_complex", "[0][1]hstack[top];[2][3]hstack[bottom];[top][bottom]vstack[v]",
			"-map", "[v]", "-map", "4:a",
			"-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12",
			"-c:a", "aac", "-ar", "48000", "-ac", "2",
			"-shortest", out,
		]),
	);
}

/** VP8 + Opus in WebM — a codec pair MP4 can't hold, so tools must re-encode it. */
export function webmVp8(name: string, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-c:v", "libvpx", "-b:v", "500k", "-c:a", "libopus",
			"-shortest", out,
		]),
	);
}

/** Single-channel audio at a non-48k rate, for channel/rate handling. */
export function mp4MonoAudio(name: string, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p",
			"-c:a", "aac", "-ar", "22050", "-ac", "1",
			"-shortest", out,
		]),
	);
}

/**
 * Video carrying a 90° display-matrix rotation. Written in two passes: ffmpeg 8
 * ignores `-metadata rotate`, so the rotation is stamped on with a copy pass.
 */
export function mp4Rotated(name: string, duration = 2) {
	return cached(name, (out) => {
		const plain = `${out}.plain.mp4`;
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", plain,
		]);
		ffmpeg(["-display_rotation", "90", "-i", plain, "-c", "copy", out]);
		rmSync(plain, { force: true });
	});
}

/**
 * Variable frame rate: ~7.5fps for the first second, then 30fps. Frame durations
 * are uneven, which is what phone and screen-recording footage actually looks like.
 */
export function mp4Vfr(name: string, duration = 4) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=30:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-vf", "select='if(lt(n,30),not(mod(n,4)),1)'", "-fps_mode", "vfr",
			"-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2",
			"-shortest", out,
		]),
	);
}

/** A clip long enough that resampler drift, if any, has room to accumulate. */
export function mp4Long(name: string, duration = 30) {
	return mp4WithAudio(name, 48000, duration);
}

/**
 * A file whose packets start *before* zero, the way a macOS screen recording does:
 * an edit list hides the pre-roll, so the decoded timeline starts at 0 while the
 * raw packets do not. Tools that re-time packets have to cope with this.
 */
export function mp4NegativeStart(name: string, duration = 4) {
	return cached(name, (out) => {
		const plain = `${out}.plain.mp4`;
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2",
			"-shortest", plain,
		]);
		ffmpeg(["-i", plain, "-c", "copy", "-output_ts_offset", "-1.0", out]);
		rmSync(plain, { force: true });
	});
}

/** MPEG-4 Part 2 video — a codec mediabunny's demuxer cannot read at all. */
export function mp4UnsupportedCodec(name: string, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-c:v", "mpeg4", "-an", out,
		]),
	);
}

/**
 * HE-AAC (AAC-LC + SBR) audio, the profile WhatsApp and a lot of phone video use.
 * Its container sample rate is half the real one, and Mediabunny can never copy it
 * into an MP4 — so it's the case that exposed tools falling back to Opus.
 *
 * Needs macOS's AudioToolbox encoder; ffmpeg's native aac encoder can't write HE.
 */
export function hasHeAacEncoder() {
	try {
		const out = execFileSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
		return /\baac_at\b/.test(out);
	} catch {
		return false;
	}
}

export function mp4HeAac(name: string, duration = 3) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p",
			"-c:a", "aac_at", "-profile:a", "4", "-b:a", "48k", "-ar", "44100", "-ac", "2",
			"-shortest", out,
		]),
	);
}

/**
 * Matroska. Used here for the containers Web Audio may refuse — Chromium reads
 * this one natively, but Firefox and Safari are narrower, and the streaming
 * decoder is the fallback for exactly that.
 */
export function mkvWithAudio(name: string, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `testsrc=size=320x240:rate=15:duration=${duration}`,
			"-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`,
			"-c:v", "libx264", "-pix_fmt", "yuv420p",
			"-c:a", "aac", "-ar", "48000", "-ac", "2",
			"-shortest", "-f", "matroska", out,
		]),
	);
}

/**
 * A single pure tone at 48kHz, uncompressed, in Matroska.
 *
 * Uncompressed and mono on purpose: these are used to compare one frequency
 * against another, so the only difference between two of them has to be the
 * frequency. A codec in the way would attenuate the two differently and the
 * comparison would measure the encoder instead. Note ffmpeg's sine source is
 * not full scale — it peaks around 0.125.
 */
export function mkvTone(name: string, hz: number, duration = 2) {
	return cached(name, (out) =>
		ffmpeg([
			"-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${duration}`,
			"-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1",
			"-f", "matroska", out,
		]),
	);
}

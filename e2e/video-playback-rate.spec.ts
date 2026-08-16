import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(__dirname, ".fixtures");

function hasFfmpeg() {
	try {
		execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function makeMp4() {
	mkdirSync(FIXTURE_DIR, { recursive: true });
	const out = join(FIXTURE_DIR, "rate.mp4");
	if (existsSync(out)) return out;
	execFileSync(
		"ffmpeg",
		// prettier-ignore
		[
			"-y",
			"-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=5",
			"-f", "lavfi", "-i", "sine=frequency=440:duration=5",
			"-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
			out,
		],
		{ stdio: "ignore" },
	);
	return out;
}

test.describe("VideoPreview playback speed", () => {
	test.skip(!hasFfmpeg(), "ffmpeg is required to build the video fixture");

	test("speed menu sets the element's playbackRate", async ({ page }) => {
		// The shared VideoPreview player is what every video tool shows for its result,
		// so drive a real conversion to get to it.
		await page.goto("/video/convert");
		// The dropzone creates its <input type="file"> on demand, so go through the file chooser.
		const chooser = page.waitForEvent("filechooser");
		await page.getByText(/drop|choose|browse|select/i).first().click();
		await (await chooser).setFiles(makeMp4());

		await page.getByRole("button", { name: /^Convert to / }).click();

		const video = page.locator("video").first();
		await expect(video).toBeVisible({ timeout: 30_000 });

		// Default rate, shown on the speed button.
		const speedButton = page.getByTitle("Playback speed");
		await expect(speedButton).toHaveText("1×");
		expect(await video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1);

		// Hovering opens the menu; picking a rate applies it to the element.
		await speedButton.hover();
		await page.getByRole("button", { name: "1.5×", exact: true }).click();

		await expect(speedButton).toHaveText("1.5×");
		expect(await video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.5);

		// And a slow rate, to prove it isn't one-way.
		await speedButton.hover();
		await page.getByRole("button", { name: "0.5×", exact: true }).click();
		expect(await video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(0.5);
	});

	test("menu survives the mouse travelling up into it", async ({ page }) => {
		await page.goto("/video/convert");
		const chooser = page.waitForEvent("filechooser");
		await page.getByText(/drop|choose|browse|select/i).first().click();
		await (await chooser).setFiles(makeMp4());
		await page.getByRole("button", { name: /^Convert to / }).click();
		await expect(page.locator("video").first()).toBeVisible({ timeout: 30_000 });

		const speedButton = page.getByTitle("Playback speed");
		// Hover then click, the way a hand actually reaches a button. The click must not
		// toggle the hover-opened menu shut.
		await speedButton.hover();
		await speedButton.click();

		const option = page.getByRole("button", { name: "2×", exact: true });
		await expect(option).toBeVisible();

		// Walk the cursor from the button up to the option the way a hand would,
		// rather than teleporting. Any dead gap in between closes the menu.
		const from = (await speedButton.boundingBox())!;
		const to = (await option.boundingBox())!;
		const startY = from.y + from.height / 2;
		const endY = to.y + to.height / 2;
		for (let i = 0; i <= 20; i++) {
			const t = i / 20;
			await page.mouse.move(
				from.x + from.width / 2 + (to.x + to.width / 2 - (from.x + from.width / 2)) * t,
				startY + (endY - startY) * t,
			);
		}

		await expect(option).toBeVisible();
		await option.click();
		expect(await page.locator("video").first().evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(2);
	});
});

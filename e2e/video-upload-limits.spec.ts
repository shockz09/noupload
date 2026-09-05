import { expect, test } from "@playwright/test";

/**
 * FileDropzone defaults to a 100MB cap when no `maxSize` is passed, which silently
 * turns away ordinary recordings — a 104MB screen capture is nothing unusual. Every
 * video route has to opt into VIDEO_MAX_FILE_SIZE explicitly, and four of them had
 * quietly missed it. Cheap to assert, easy to forget when adding the next tool.
 */
const VIDEO_ROUTES = [
	"/video/compress",
	"/video/trim",
	"/video/convert",
	"/video/remove-audio",
	"/video/add-audio",
	"/video/speed",
	"/video/to-gif",
	"/video/extract-audio",
	"/video/metadata",
	"/video/merge",
	"/video/rotate",
	"/video/resize",
	"/video/crop",
];

for (const route of VIDEO_ROUTES) {
	test(`${route} advertises the 2GB video limit`, async ({ page }) => {
		await page.goto(route, { waitUntil: "domcontentloaded" });
		await expect(page.getByText(/Max 2048MB/).first()).toBeVisible({ timeout: 30_000 });
		// And nothing on the page is still offering the 100MB default.
		await expect(page.getByText(/Max 100MB/)).toHaveCount(0);
	});
}

import { expect, test, type Page } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wait for the file input to appear, then set files on it.
 * The dropzone component renders a hidden <input type="file">.
 */
async function uploadFile(page: Page, filePath: string) {
	const input = page.locator('input[type="file"]');
	await input.waitFor({ state: "attached" });
	await input.setInputFiles(filePath);
}

// ─── Video Convert: LRV support ─────────────────────────────────────────────

test.describe("GoPro LRV in Video Convert", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/video/convert");
	});

	test("dropzone accepts .lrv files and shows format options", async ({ page }) => {
		// The accept attribute should include .lrv
		const input = page.locator('input[type="file"]');
		const accept = await input.getAttribute("accept");
		expect(accept).toContain(".lrv");

		// Subtitle should mention GoPro LRV
		await expect(page.getByText(/GoPro LRV/i)).toBeVisible();

		// Upload an LRV file
		await uploadFile(page, "test-assets/test_clip.lrv");

		// File should be accepted — format selector should appear
		// (LRV maps to "mp4" source, so all non-mp4 formats are available: mov, webm, mkv)
		await expect(page.getByText("Output Format")).toBeVisible();
		await expect(page.getByText("MOV")).toBeVisible();
		await expect(page.getByText("WebM")).toBeVisible();
		await expect(page.getByText("MKV")).toBeVisible();

		// MP4 should NOT appear since source is LRV→MP4 (no point converting mp4→mp4)
		// The format selector filters out the source format
		const mp4Button = page.locator('button', { hasText: /^MP4$/ });
		await expect(mp4Button).toHaveCount(0);
	});

	test("converts LRV to WebM successfully", async ({ page }) => {
		await uploadFile(page, "test-assets/test_clip.lrv");

		// Select WebM
		await page.getByText("WebM", { exact: true }).click();

		// Click convert
		const convertBtn = page.getByRole("button", { name: /Convert to/i });
		await convertBtn.click();

		// Wait for conversion to complete — success view appears
		await expect(page.getByText("Video Converted!")).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(/Download WEBM/i)).toBeVisible();
	});

	test("converts LRV to MKV successfully", async ({ page }) => {
		await uploadFile(page, "test-assets/test_clip.lrv");

		await page.getByText("MKV", { exact: true }).click();
		await page.getByRole("button", { name: /Convert to/i }).click();

		await expect(page.getByText("Video Converted!")).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(/Download MKV/i)).toBeVisible();
	});
});

// ─── Image Convert: THM support ─────────────────────────────────────────────

test.describe("GoPro THM in Image Convert", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/image/convert");
	});

	test("dropzone accepts .thm files", async ({ page }) => {
		const input = page.locator('input[type="file"]');
		const accept = await input.getAttribute("accept");
		expect(accept).toContain(".thm");
	});

	test("loads THM file and converts to PNG", async ({ page }) => {
		await uploadFile(page, "test-assets/test_thumb.thm");

		// File should be accepted — format options should appear
		// THM is JPEG, so the auto-selected format should be PNG
		await expect(page.getByText("JPEG")).toBeVisible();
		await expect(page.getByText("PNG")).toBeVisible();

		// Convert to PNG
		const convertBtn = page.getByRole("button", { name: /Convert/i });
		if (await convertBtn.isVisible()) {
			await convertBtn.click();
		}

		// Result should appear
		await expect(page.getByText(/Download PNG/i)).toBeVisible({ timeout: 30_000 });
	});
});

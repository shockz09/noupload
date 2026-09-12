import { deflateSync } from "node:zlib";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Coverage for the three tools that run Ghostscript: compress, grayscale and
 * PDF/A. None of them had any, which is how a compression rewrite shipped with
 * the other two verified only by hand.
 *
 * The assertions here are the failures that actually happened: a file reported
 * as incompressible when it was not, output that came back *larger* than the
 * input, and a password-protected document silently replaced by a valid-looking
 * 2KB file with no pages in it.
 *
 * Every test drives the real UI and then reads the page count out of the result
 * preview, which pdf.js parses from the bytes the tool produced — so an output
 * that is corrupt, empty, or short a few pages fails rather than passing on a
 * plausible-looking file size.
 */

// ─── fixtures ─────────────────────────────────────────────────────────────────

function crc32(buf: Buffer): number {
	let c: number;
	let crc = 0xffffffff;
	for (let n = 0; n < buf.length; n++) {
		c = (crc ^ buf[n]) & 0xff;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crc = c ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typed));
	return Buffer.concat([len, typed, crc]);
}

/**
 * A gradient with noise laid over it, as a PNG.
 *
 * The noise is the point: a flat fill would deflate to nothing and leave no
 * room for any compressor to win, which would make "it got smaller" a test of
 * the fixture rather than of the tool.
 */
function noisyPng(w: number, h: number): Buffer {
	const raw = Buffer.alloc(h * (1 + w * 3));
	let seed = 987654321;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return (seed >>> 8) & 0xff;
	};
	for (let y = 0; y < h; y++) {
		const off = y * (1 + w * 3);
		raw[off] = 0; // filter: none
		for (let x = 0; x < w; x++) {
			const p = off + 1 + x * 3;
			raw[p] = ((x * 255) / w) | 0;
			raw[p + 1] = ((y * 255) / h) | 0;
			raw[p + 2] = (((x ^ y) & 0xff) + rnd()) >> 1;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 6 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** Pages carrying a photo-sized image at roughly 170 DPI — the shrinkable case. */
async function photoPdf(pages = 1): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const img = await doc.embedPng(noisyPng(1200, 900));
	for (let i = 0; i < pages; i++) {
		doc.addPage([612, 792]).drawImage(img, { x: 56, y: 296, width: 500, height: 375 });
	}
	return Buffer.from(await doc.save());
}

/** Text only: nothing to downsample, so the lossless engines carry this one. */
async function textPdf(pages = 3): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let i = 0; i < pages; i++) {
		const page = doc.addPage([612, 792]);
		for (let line = 0; line < 40; line++) {
			page.drawText(`Page ${i + 1}, line ${line} — the quick brown fox jumps over the lazy dog.`, {
				x: 40,
				y: 740 - line * 18,
				size: 11,
				font,
				color: rgb(0, 0, 0),
			});
		}
	}
	return Buffer.from(await doc.save());
}

// ─── harness ──────────────────────────────────────────────────────────────────

/**
 * One context for the whole file. Ghostscript's WASM is a 16MB CDN download
 * cached through the Cache API, and a fresh context per test would re-fetch it
 * every time.
 */
let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }: { browser: Browser }) => {
	context = await browser.newContext();
	page = await context.newPage();
});

test.afterAll(async () => {
	await context?.close();
});

async function open(route: string, buffer: Buffer, name = "fixture.pdf") {
	await page.goto(route, { waitUntil: "domcontentloaded" });
	const chooser = page.waitForEvent("filechooser");
	await page.locator('.dropzone, [role="button"]').first().click();
	await (await chooser).setFiles({ name, mimeType: "application/pdf", buffer });
	await page.waitForSelector("text=Change file", { timeout: 30_000 });
}

/** The page count the result preview read back out of the produced PDF. */
async function previewPageCount(): Promise<number> {
	const indicator = page.getByText(/^\d+ PAGES?$/);
	await indicator.waitFor({ timeout: 120_000 });
	const text = (await indicator.textContent()) ?? "";
	return Number.parseInt(text, 10);
}

/** "2.5 MB → 412 KB · 84% smaller" and friends, as bytes. */
function parseSize(text: string): number {
	const m = text.match(/([\d.]+)\s*(B|KB|MB|GB)/i);
	if (!m) return Number.NaN;
	const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[m[2].toLowerCase()] ?? 1;
	return Number.parseFloat(m[1]) * mult;
}

// ─── compress ─────────────────────────────────────────────────────────────────

test.describe("compress PDF", () => {
	test("an image-heavy PDF actually gets smaller", async () => {
		test.setTimeout(240_000);
		const source = await photoPdf(1);
		await open("/compress", source);

		await page.getByRole("button", { name: /^Compress PDF$/ }).last().click();
		await page.waitForSelector("text=/PDF Compressed!|Squeezed a Little|No Safe Reduction/", { timeout: 200_000 });

		// The complaint that started all this: a compressible file told to go away.
		await expect(page.getByText("No Safe Reduction Left")).toHaveCount(0);
		await expect(page.getByText("PDF Compressed!")).toBeVisible();
		await expect(page.getByText("0 PAGES")).toHaveCount(0);

		const body = await page.locator("main").innerText();
		const percent = Number.parseInt(body.match(/(\d+)% smaller/)?.[1] ?? "0", 10);
		expect(percent).toBeGreaterThanOrEqual(20);

		// Parses, and still has its page.
		expect(await previewPageCount()).toBe(1);
	});

	test("a text-only PDF never comes back larger than it went in", async () => {
		test.setTimeout(240_000);
		const source = await textPdf(3);
		await open("/compress", source);

		await page.getByRole("button", { name: /^Compress PDF$/ }).last().click();
		await page.waitForSelector("text=/PDF Compressed!|Squeezed a Little|No Safe Reduction/", { timeout: 200_000 });

		const body = await page.locator("main").innerText();
		// Ghostscript used to rewrite a text document into a bigger one and hand
		// that back as the result. Whatever the router picks, it may not inflate.
		expect(body).not.toMatch(/% larger/);

		const arrow = body.match(/([\d.]+\s*(?:B|KB|MB))\s*→\s*([\d.]+\s*(?:B|KB|MB))/);
		if (arrow) expect(parseSize(arrow[2])).toBeLessThanOrEqual(parseSize(arrow[1]));

		expect(await previewPageCount()).toBe(3);
	});

	test("a text document is not offered a harder squeeze it cannot deliver", async () => {
		test.setTimeout(240_000);
		// Only the image passes vary by level, so on a text document every level
		// produces the same bytes and the button would be a lie.
		await expect(page.getByRole("button", { name: /Squeeze harder/ })).toHaveCount(0);
	});

	test("a password-protected PDF is refused, not silently emptied", async () => {
		test.setTimeout(240_000);

		// Build the encrypted fixture with the app's own encrypt tool, so the test
		// needs no qpdf on the machine running it.
		await open("/encrypt", await textPdf(3), "secret.pdf");
		await page.getByLabel("Password").fill("hunter2");
		await page.getByRole("button", { name: /^Encrypt PDF$/ }).click();
		await page.waitForSelector("text=PDF Encrypted!", { timeout: 120_000 });

		const encrypted = await page.evaluate(async () => {
			const originalCreate = URL.createObjectURL.bind(URL);
			const seen: Blob[] = [];
			URL.createObjectURL = (b: Blob) => {
				if (b?.type === "application/pdf") seen.push(b);
				return originalCreate(b);
			};
			document.querySelectorAll("button").forEach((b) => {
				if (/download/i.test(b.textContent ?? "")) b.click();
			});
			URL.createObjectURL = originalCreate;
			const blob = seen[seen.length - 1];
			if (!blob) return null;
			const bytes = new Uint8Array(await blob.arrayBuffer());
			let binary = "";
			for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
			return btoa(binary);
		});
		expect(encrypted, "encrypt tool produced a downloadable PDF").not.toBeNull();
		const encryptedPdf = Buffer.from(encrypted as string, "base64");

		await open("/compress", encryptedPdf, "secret.pdf");
		await page.getByRole("button", { name: /^Compress PDF$/ }).last().click();

		// Ghostscript exits 0 on these and writes a ~2KB file with no pages, which
		// used to be reported as a 99% saving on a document that no longer existed.
		await page.waitForSelector("text=/password protected/i", { timeout: 120_000 });
		await expect(page.getByText(/Decrypt PDF tool/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /^Download PDF$/ })).toHaveCount(0);
	});
});

// ─── grayscale and PDF/A ──────────────────────────────────────────────────────

test.describe("the other Ghostscript tools", () => {
	test("grayscale converts and keeps every page", async () => {
		test.setTimeout(240_000);
		await open("/grayscale", await photoPdf(3));
		await page.getByRole("button", { name: /Convert to Grayscale/ }).last().click();
		await page.waitForSelector("text=PDF Converted to Grayscale!", { timeout: 200_000 });
		expect(await previewPageCount()).toBe(3);
	});

	test("PDF/A converts and keeps every page", async () => {
		test.setTimeout(300_000);
		await open("/pdf-to-pdfa", await textPdf(3));
		await page.getByRole("button", { name: /Convert to PDF\/A/ }).last().click();
		await page.waitForSelector("text=Converted to PDF/A!", { timeout: 260_000 });

		// Checked in this window on purpose: totalPages starts at 0 and the bar
		// used to render straight away, so a large result read "0 PAGES" for the
		// seconds pdf.js spent parsing it. PDF/A output is the biggest we make.
		await expect(page.getByText("0 PAGES")).toHaveCount(0);

		expect(await previewPageCount()).toBe(3);
	});
});

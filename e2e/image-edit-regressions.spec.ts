import { expect, test, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";

// ─── a solid-white PNG of any size, built here so the spec needs no fixtures ──

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

function crc32(buf: Buffer): number {
	let c = ~0;
	for (const byte of buf) {
		c ^= byte;
		for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
	}
	return ~c >>> 0;
}

function whitePng(width: number, height: number): Buffer {
	const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xff)]);
	const raw = Buffer.concat(Array.from({ length: height }, () => row));
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // truecolor
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// ─── harness ──────────────────────────────────────────────────────────────────

async function openEditor(page: Page, width: number, height: number) {
	await page.goto("/image/edit", { waitUntil: "domcontentloaded" });
	const chooser = page.waitForEvent("filechooser");
	await page.locator('.dropzone, [role="button"]').first().click();
	await (await chooser).setFiles({
		name: `white-${width}x${height}.png`,
		mimeType: "image/png",
		buffer: whitePng(width, height),
	});
	await page.waitForSelector("canvas.upper-canvas", { timeout: 30_000 });
	await page.waitForTimeout(1000);
	const box = (await page.locator("canvas.upper-canvas").boundingBox())!;
	// Editor scale: css pixels per image pixel.
	return { box, zoom: box.width / width };
}

type BBox = [number, number, number, number];

/** Downloads the export and returns the bounds of everything that isn't white. */
async function exportedMarkBounds(page: Page): Promise<{ w: number; h: number; marked: number; bbox: BBox }> {
	const downloaded = page.waitForEvent("download", { timeout: 30_000 });
	await page.getByRole("button", { name: /Export/ }).click();
	await page.getByRole("button", { name: /Download PNG/ }).click();
	const download = await downloaded;
	const path = (await download.path())!;
	const buffer = (await import("node:fs")).readFileSync(path);

	return page.evaluate(async (dataUrl) => {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const i = new Image();
			i.onload = () => resolve(i);
			i.onerror = () => reject(new Error("export did not decode"));
			i.src = dataUrl;
		});
		const canvas = document.createElement("canvas");
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext("2d")!;
		ctx.drawImage(img, 0, 0);
		const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = -1;
		let maxY = -1;
		let marked = 0;
		for (let y = 0; y < canvas.height; y++) {
			for (let x = 0; x < canvas.width; x++) {
				const i = (y * canvas.width + x) * 4;
				if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) {
					marked++;
					if (x < minX) minX = x;
					if (y < minY) minY = y;
					if (x > maxX) maxX = x;
					if (y > maxY) maxY = y;
				}
			}
		}
		return { w: canvas.width, h: canvas.height, marked, bbox: [minX, minY, maxX, maxY] as BBox };
	}, `data:image/png;base64,${buffer.toString("base64")}`);
}

async function drag(page: Page, box: { x: number; y: number }, from: [number, number], to: [number, number]) {
	await page.mouse.move(box.x + from[0], box.y + from[1]);
	await page.mouse.down();
	await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 12 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}

// ─── the export must contain what was drawn, where it was drawn ───────────────

// Shapes are created 0x0 on mouse:down and grown with set({width, height}) as
// the pointer moves. set() does not refresh fabric's cached corner coords, so
// the record written for the export used to carry the 0x0 creation bounds and
// every rectangle/ellipse came out of the exporter as a dot in the corner —
// the annotations looked absent in the downloaded file.
for (const shape of [
	{ tool: "rectangle", key: "r" },
	{ tool: "ellipse", key: "c" },
	{ tool: "freehand stroke", key: "d" },
]) {
	test(`a ${shape.tool} exports where it was drawn`, async ({ page }) => {
		const { box } = await openEditor(page, 400, 300);
		await page.keyboard.press(shape.key);
		await page.waitForTimeout(200);
		await drag(page, box, [50, 50], [150, 110]);

		const exported = await exportedMarkBounds(page);

		expect(exported.w).toBe(400);
		expect(exported.marked).toBeGreaterThan(150);
		// The 3px default stroke straddles the drag path, hence the tolerance.
		expect(exported.bbox[0]).toBeGreaterThan(44);
		expect(exported.bbox[0]).toBeLessThan(54);
		expect(exported.bbox[1]).toBeGreaterThan(44);
		expect(exported.bbox[1]).toBeLessThan(54);
		expect(exported.bbox[2]).toBeGreaterThan(146);
		expect(exported.bbox[2]).toBeLessThan(156);
		expect(exported.bbox[3]).toBeGreaterThan(106);
		expect(exported.bbox[3]).toBeLessThan(116);
	});
}

test("typed text exports where it was placed", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await page.keyboard.press("t");
	await page.mouse.click(box.x + 60, box.y + 60);
	await page.waitForTimeout(300);
	await page.keyboard.type("HELLO");
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);

	const exported = await exportedMarkBounds(page);
	expect(exported.marked).toBeGreaterThan(50);
	expect(Math.abs(exported.bbox[0] - 60)).toBeLessThan(8);
	expect(Math.abs(exported.bbox[1] - 60)).toBeLessThan(8);
});

// An image too large for the viewport is edited at a fit zoom below 1, so every
// record has to be scaled back into image pixels on export.
for (const shape of [
	{ tool: "rectangle", key: "r" },
	{ tool: "freehand stroke", key: "d" },
]) {
	test(`a ${shape.tool} on a zoomed-out image exports at full resolution`, async ({ page }) => {
		const { box, zoom } = await openEditor(page, 2000, 1500);
		expect(zoom).toBeLessThan(1);

		await page.keyboard.press(shape.key);
		await page.waitForTimeout(200);
		await drag(page, box, [60, 60], [200, 130]);

		const exported = await exportedMarkBounds(page);
		expect(exported.w).toBe(2000);
		expect(exported.h).toBe(1500);

		const tolerance = 6 / zoom;
		const expected: BBox = [60 / zoom, 60 / zoom, 200 / zoom, 130 / zoom];
		for (let i = 0; i < 4; i++) {
			expect(Math.abs(exported.bbox[i] - expected[i])).toBeLessThan(tolerance);
		}
	});
}

// The init effect keyed off a ref, which no re-render ever observed. An image
// that already fits at 100% produces a fit zoom equal to the starting zoom, so
// nothing re-ran the effect and the editor came up with no fabric canvas and no
// background at all — whatever you did, the export was the untouched original.
test("the editor initialises for an image that fits at 100%", async ({ page }) => {
	const { zoom } = await openEditor(page, 400, 300);
	expect(zoom).toBe(1);

	const canvases = await page.evaluate(() =>
		Array.from(document.querySelectorAll("canvas")).map((c) => ({
			cls: c.className,
			w: c.width,
			h: c.height,
		})),
	);
	// Background canvas plus fabric's lower/upper pair, all at image size.
	expect(canvases.length).toBeGreaterThanOrEqual(3);
	for (const c of canvases) {
		expect(c.w).toBe(400);
		expect(c.h).toBe(300);
	}
});

// Stroke width and font size are on-screen pixels while the export writes image
// pixels, so a fit zoom below 1 has to scale them too. Without that, text typed
// on a large photo exported at a third of the size it was typed at.
test("text keeps its on-screen size when exported from a zoomed-out image", async ({ page }) => {
	const { box, zoom } = await openEditor(page, 2000, 1500);
	expect(zoom).toBeLessThan(1);

	await page.keyboard.press("t");
	await page.mouse.click(box.x + 60, box.y + 60);
	await page.waitForTimeout(300);
	await page.keyboard.type("HELLO");
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);

	const exported = await exportedMarkBounds(page);
	const glyphHeight = exported.bbox[3] - exported.bbox[1];
	// Cap height of 24px "HELLO" is ~18 css px; at this zoom that is ~18/zoom
	// image pixels.
	expect(glyphHeight).toBeGreaterThan((18 / zoom) * 0.7);
	expect(glyphHeight).toBeLessThan((18 / zoom) * 1.3);
});

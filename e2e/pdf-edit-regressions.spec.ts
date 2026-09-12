import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";

/**
 * Coverage for the PDF editor's fabric layer: what you draw on a page has to
 * survive the record → fabric → export round trip and land where you put it.
 *
 * Everything here drives the real UI and then rasterises the *exported* PDF, so
 * a regression in editor-objects.ts or export-pdf.ts fails the test rather than
 * quietly shipping. pdf.js is loaded from node_modules through the dev server —
 * the app points its worker at unpkg, which would make these network-bound.
 */

// ─── fixtures ─────────────────────────────────────────────────────────────────

/** A blank white PDF, built here so the spec needs no checked-in assets. */
async function blankPdf(width: number, height: number, pages = 1): Promise<Buffer> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pages; i++) {
		const page = doc.addPage([width, height]);
		page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
	}
	return Buffer.from(await doc.save());
}

// ─── harness ──────────────────────────────────────────────────────────────────

async function openEditor(page: Page, width: number, height: number, pages = 1) {
	await page.goto("/edit", { waitUntil: "domcontentloaded" });
	const chooser = page.waitForEvent("filechooser");
	await page.locator('.dropzone, [role="button"]').first().click();
	await (await chooser).setFiles({
		name: "blank.pdf",
		mimeType: "application/pdf",
		buffer: await blankPdf(width, height, pages),
	});
	await page.waitForSelector("canvas.upper-canvas", { timeout: 30_000 });
	await page.waitForTimeout(800);
	const box = (await page.locator("canvas.upper-canvas").boundingBox())!;
	return { box, zoom: box.width / width };
}

type BBox = [number, number, number, number];
type Raster = { w: number; h: number; marked: number; bbox: BBox; pages: number };

/**
 * Exports, then renders page 1 of the downloaded PDF and reports the bounds of
 * everything that isn't white.
 */
async function exportedMarkBounds(page: Page, opts: { confirmRedaction?: boolean } = {}): Promise<Raster> {
	const downloaded = page.waitForEvent("download", { timeout: 30_000 });
	await page.getByTitle("Export PDF", { exact: true }).click();
	if (opts.confirmRedaction) {
		await page.getByRole("button", { name: "Apply & Export" }).click();
	}
	const download = await downloaded;
	const buffer = readFileSync((await download.path())!);

	return page.evaluate(async (base64) => {
		// @ts-expect-error -- dev-server module path
		const lib: typeof import("pdfjs-dist") = await import("/node_modules/pdfjs-dist/build/pdf.mjs");
		lib.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/build/pdf.worker.mjs";

		const raw = atob(base64);
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

		const pdf = await lib.getDocument({ data: bytes }).promise;
		const p = await pdf.getPage(1);
		const viewport = p.getViewport({ scale: 1 });
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		const ctx = canvas.getContext("2d")!;
		// The page itself is white; paint the ground so alpha reads as unmarked.
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		await p.render({ canvasContext: ctx, viewport, canvas }).promise;

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
		return { w: canvas.width, h: canvas.height, marked, bbox: [minX, minY, maxX, maxY], pages: pdf.numPages };
	}, buffer.toString("base64")) as Promise<Raster>;
}

async function drag(page: Page, box: { x: number; y: number }, from: [number, number], to: [number, number]) {
	await page.mouse.move(box.x + from[0], box.y + from[1]);
	await page.mouse.down();
	await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 12 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}

/** The Shapes button's own click selects shape-rect; its caret opens the menu. */
async function pickRectangle(page: Page) {
	await page.getByTitle("Shapes", { exact: true }).click();
	await page.waitForTimeout(200);
}

function expectNear(actual: number, expected: number, tolerance: number) {
	expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}

// ─── what is drawn has to reach the exported page ─────────────────────────────

test("a rectangle exports where it was drawn", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickRectangle(page);
	await drag(page, box, [50, 50], [150, 110]);

	const exported = await exportedMarkBounds(page);

	expect(exported.pages).toBe(1);
	expect(exported.w).toBe(400);
	expect(exported.h).toBe(300);
	expect(exported.marked).toBeGreaterThan(150);
	// The stroke straddles the drag path, hence the tolerance.
	expectNear(exported.bbox[0], 50, 6);
	expectNear(exported.bbox[1], 50, 6);
	expectNear(exported.bbox[2], 150, 6);
	expectNear(exported.bbox[3], 110, 6);
});

test("typed text exports where it was placed", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await page.getByTitle("Text (T)", { exact: true }).click();
	await page.mouse.click(box.x + 60, box.y + 60);
	await page.waitForTimeout(300);
	await page.keyboard.type("HELLO");
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);

	const exported = await exportedMarkBounds(page);

	expect(exported.marked).toBeGreaterThan(50);
	expectNear(exported.bbox[0], 60, 12);
	expectNear(exported.bbox[1], 60, 12);
});

// ─── undo/redo goes through fabric's serializer ───────────────────────────────

// Undo and redo replay canvas snapshots through loadFromJSON, which rebuilds
// every object from its serialized form. A break in the custom-property or
// enliven path shows up here as an annotation that never comes back — or one
// that comes back in the wrong place.
test("undo drops the annotation from the export and redo restores it", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickRectangle(page);
	await drag(page, box, [50, 50], [150, 110]);

	const drawn = await exportedMarkBounds(page);
	expect(drawn.marked).toBeGreaterThan(150);

	await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
	await page.waitForTimeout(600);
	const undone = await exportedMarkBounds(page);
	expect(undone.marked).toBe(0);

	await page.getByTitle("Redo (Ctrl+Shift+Z)", { exact: true }).click();
	await page.waitForTimeout(600);
	const redone = await exportedMarkBounds(page);

	expect(redone.marked).toBeGreaterThan(150);
	// Back in the same place, not merely back on the page.
	for (let i = 0; i < 4; i++) {
		expectNear(redone.bbox[i], drawn.bbox[i], 6);
	}
});

// ─── redaction has to be opaque in the export ────────────────────────────────

// Redactions render through a fabric Pattern on the canvas but must burn in as
// solid coverage on export — a pattern that survived into the PDF would leave
// the content underneath legible.
test("a redaction exports as solid coverage", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await page.getByTitle("Redact", { exact: true }).click();
	await page.waitForTimeout(200);
	await drag(page, box, [60, 60], [200, 140]);

	const exported = await exportedMarkBounds(page, { confirmRedaction: true });

	expectNear(exported.bbox[0], 60, 6);
	expectNear(exported.bbox[1], 60, 6);
	expectNear(exported.bbox[2], 200, 6);
	expectNear(exported.bbox[3], 140, 6);
	// Solid, not an outline: the filled area is ~140x80.
	expect(exported.marked).toBeGreaterThan(140 * 80 * 0.8);
});

// ─── page geometry survives the export ───────────────────────────────────────

test("the export keeps the original page count and size", async ({ page }) => {
	const { box } = await openEditor(page, 612, 792, 3);
	await pickRectangle(page);
	await drag(page, box, [40, 40], [120, 90]);

	const exported = await exportedMarkBounds(page);

	expect(exported.pages).toBe(3);
	expect(exported.w).toBe(612);
	expect(exported.h).toBe(792);
});

import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

/**
 * A white page carrying one line of real Helvetica text, so pdf.js has
 * something to extract and click-to-edit has a region to promote.
 * TEXT_BOX is where that line lands in top-left page coordinates — the same
 * space the fabric canvas uses at zoom 1.
 */
const TEXT_SIZE = 24;
const TEXT_BASELINE_Y = 250;
const TEXT_LEFT = 50;
const TEXT_BOX = {
	left: TEXT_LEFT,
	top: 300 - TEXT_BASELINE_Y - TEXT_SIZE,
	clickX: TEXT_LEFT + 20,
	clickY: 300 - TEXT_BASELINE_Y - TEXT_SIZE / 2,
};

async function textPdf(width: number, height: number): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([width, height]);
	page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
	page.drawText("Hello", {
		x: TEXT_LEFT,
		y: TEXT_BASELINE_Y,
		size: TEXT_SIZE,
		font: await doc.embedFont(StandardFonts.Helvetica),
		color: rgb(0, 0, 0),
	});
	// No object streams: staleLengthPdf needs a direct `/Length` to corrupt.
	return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/**
 * The same page, saved with a deliberately stale `/Length` on its first content
 * stream — the single most common way real-world PDFs are malformed. Viewers
 * recover by scanning for the `endstream` keyword; a parser that trusts
 * `/Length` blindly walks off the end of the stream instead.
 */
async function staleLengthPdf(width: number, height: number): Promise<Buffer> {
	const good = await textPdf(width, height);
	const text = good.toString("latin1");
	const match = /\/Length (\d+)\s*>>\s*stream/.exec(text);
	if (!match) throw new Error("fixture has no direct-/Length stream to corrupt");
	const stale = match[0].replace(`/Length ${match[1]}`, `/Length ${Number(match[1]) - 7}`);
	return Buffer.from(text.replace(match[0], stale), "latin1");
}

/** A page carrying one AcroForm text field, for the form-overlay tests. */
async function formPdf(width: number, height: number): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([width, height]);
	page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
	const field = doc.getForm().createTextField("who");
	field.setText("");
	field.addToPage(page, { x: 40, y: 220, width: 200, height: 24 });
	return Buffer.from(await doc.save({ useObjectStreams: false }));
}

// ─── harness ──────────────────────────────────────────────────────────────────

async function openEditor(page: Page, width: number, height: number, pages = 1, fixture?: Buffer) {
	await page.goto("/edit", { waitUntil: "domcontentloaded" });
	const chooser = page.waitForEvent("filechooser");
	await page.locator('.dropzone, [role="button"]').first().click();
	await (await chooser).setFiles({
		name: "blank.pdf",
		mimeType: "application/pdf",
		buffer: fixture ?? (await blankPdf(width, height, pages)),
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


// ─── click-to-edit must not resurrect deleted text ───────────────────────────

// Clicking detected text promotes it to an editable IText backed by a whiteout
// that hides the original glyphs. Clearing the replacement leaves that whiteout
// in place — which is what makes the text *stay* gone. Two regressions live
// here:
//
//   * the click handler read only the extracted regions, which come from the
//     untouched PDF and were never pruned, so the next click on the same spot
//     built a fresh pair and the deleted text came back;
//   * the whiteout was inset vertically, leaving the bottom few pixels of the
//     original glyphs showing through the export as a grey smear.
//
// Both assert through the export, which is the strong form: a blank page proves
// the text object is gone *and* that the original underneath stays covered.

/** Click the fixture's line of text to promote it into an editable object. */
async function clickIntoText(page: Page, box: { x: number; y: number }, zoom: number) {
	await page.mouse.click(box.x + TEXT_BOX.clickX * zoom, box.y + TEXT_BOX.clickY * zoom);
	await page.waitForTimeout(700);
}

/** Wipe the characters of the IText currently being edited, the way a user does. */
async function clearEditedText(page: Page) {
	await page.keyboard.press("ControlOrMeta+a");
	await page.keyboard.press("Backspace");
	await page.waitForTimeout(200);
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);
}

test("text deleted through click-to-edit stays deleted when the spot is clicked again", async ({ page }) => {
	const { box, zoom } = await openEditor(page, 400, 300, 1, await textPdf(400, 300));

	// The fixture's glyphs are on the page to start with.
	expect((await exportedMarkBounds(page)).marked).toBeGreaterThan(50);

	await clickIntoText(page, box, zoom);
	await clearEditedText(page);

	// Gone, and the whiteout covers the original completely — no residue.
	expect((await exportedMarkBounds(page)).marked).toBe(0);

	// The click that used to bring the text back.
	await clickIntoText(page, box, zoom);

	expect((await exportedMarkBounds(page)).marked).toBe(0);
});

test("clicking detected text twice promotes it once, not once per click", async ({ page }) => {
	const { box, zoom } = await openEditor(page, 400, 300, 1, await textPdf(400, 300));

	await clickIntoText(page, box, zoom);
	await page.keyboard.press("Escape");
	await page.waitForTimeout(300);

	// The IText is now the topmost hit target, so this should reopen it for
	// editing rather than stack a second pair underneath.
	await clickIntoText(page, box, zoom);
	await clearEditedText(page);

	// Clearing the one object empties the page. A duplicate promotion would
	// leave a second copy of the text behind.
	expect((await exportedMarkBounds(page)).marked).toBe(0);
});


// ─── malformed input must still export ───────────────────────────────────────

// A stale `/Length` is the everyday shape of a slightly-broken PDF: pdf.js
// renders it without complaint, so the file opens and edits normally, and the
// breakage only surfaces at export time. The editor used to die there with
// `Expected keyword "endstream"` and hand the user that as an error message.
test("a PDF with a stale stream /Length still exports", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300, 1, await staleLengthPdf(400, 300));

	await pickRectangle(page);
	await drag(page, box, [180, 180], [260, 240]);

	const exported = await exportedMarkBounds(page);

	await expect(page.getByText('Expected keyword "endstream"')).toHaveCount(0);
	expect(exported.pages).toBe(1);
	// The original line of text plus the rectangle we just drew.
	expect(exported.marked).toBeGreaterThan(200);
	expect(exported.bbox[3]).toBeGreaterThan(200);
});


// ─── shared helpers for the editor-behaviour tests ───────────────────────────

/** Open the Shapes dropdown (the caret beside the button) and pick one. */
async function pickShape(page: Page, label: string) {
	const group = page.locator("[data-dropdown]").filter({ has: page.getByTitle("Shapes", { exact: true }) });
	await group.locator("button").nth(1).click();
	await page.waitForTimeout(250);
	await page.getByRole("button", { name: label, exact: false }).filter({ hasText: label }).first().click();
	await page.waitForTimeout(250);
}

/** Non-white pixels on the editing surface — what the user actually sees. */
async function visibleInk(page: Page): Promise<number> {
	const shot = await page.locator("div.relative.bg-white.shadow-2xl").first().screenshot();
	return page.evaluate(async (b64) => {
		const img = new Image();
		img.src = `data:image/png;base64,${b64}`;
		await img.decode();
		const c = document.createElement("canvas");
		c.width = img.width;
		c.height = img.height;
		const ctx = c.getContext("2d")!;
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, c.width, c.height);
		ctx.drawImage(img, 0, 0);
		const d = ctx.getImageData(0, 0, c.width, c.height).data;
		let n = 0;
		for (let i = 0; i < d.length; i += 4) if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) n++;
		return n;
	}, shot.toString("base64"));
}

// ─── undo/redo has to preserve what each object *is* ─────────────────────────

// History snapshots go through fabric's serializer. `toJSON()` writes none of
// the editor's own properties, so a round trip used to hand back objects that
// had forgotten their kind, their image data, their arrow geometry and the flag
// marking helper shapes — an arrow came back as a bare line with its head
// promoted to a real object, and the export changed underneath the user.
test("an arrow survives undo and redo byte for byte", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickShape(page, "Arrow");
	await drag(page, box, [60, 60], [220, 160]);

	const drawn = await exportedMarkBounds(page);
	expect(drawn.marked).toBeGreaterThan(100);

	await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
	await page.waitForTimeout(700);
	await page.getByTitle("Redo (Ctrl+Shift+Z)", { exact: true }).click();
	await page.waitForTimeout(700);

	const after = await exportedMarkBounds(page);
	expect(after.marked).toBe(drawn.marked);
	expect(after.bbox).toEqual(drawn.bbox);
});

// ─── form fields ─────────────────────────────────────────────────────────────

// pdf.js reports maxLen 0 for a text field with no /MaxLen. Handed straight to
// the input's maxLength, it capped every field at zero characters.
test("an AcroForm text field can be typed into", async ({ page }) => {
	await openEditor(page, 400, 300, 1, await formPdf(400, 300));

	const input = page.locator("input[type=text]").first();
	await input.click();
	await page.keyboard.type("Hello");
	await page.waitForTimeout(400);

	expect(await input.inputValue()).toBe("Hello");
});

// The canvas shortcut handler listens on `window`, so it also heard keys typed
// into the form overlay: Backspace deleted the selected annotation instead of a
// character, and swallowed the keystroke on the way.
test("typing in a form field does not delete the selected annotation", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300, 1, await formPdf(400, 300));

	await pickRectangle(page);
	await drag(page, box, [40, 120], [140, 180]);
	await page.waitForTimeout(400);
	const before = (await exportedMarkBounds(page)).marked;

	await page.getByTitle("Select (V)", { exact: true }).click();
	await page.mouse.click(box.x + 90, box.y + 150);
	await page.waitForTimeout(300);

	const input = page.locator("input[type=text]").first();
	await input.click();
	await page.keyboard.type("abc");
	await page.keyboard.press("Backspace");
	await page.waitForTimeout(600);

	// The field handled its own Backspace...
	expect(await input.inputValue()).toBe("ab");
	// ...and the rectangle is still in the document.
	expect((await exportedMarkBounds(page)).marked).toBeGreaterThanOrEqual(before);
});

// ─── deleting has to take the decoration with it ─────────────────────────────

// An arrow's head is a separate non-selectable helper. Deleting the line alone
// left the head stranded on the page.
test("deleting an arrow removes its head too", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickShape(page, "Arrow");
	await drag(page, box, [60, 60], [220, 160]);
	expect(await visibleInk(page)).toBeGreaterThan(100);

	await page.getByTitle("Select (V)", { exact: true }).click();
	await page.mouse.click(box.x + 140, box.y + 110);
	await page.waitForTimeout(300);
	await page.keyboard.press("Delete");
	await page.waitForTimeout(700);

	expect(await visibleInk(page)).toBe(0);
});

// A click with no drag left a zero-sized shape: invisible on the canvas, a
// stray dot in the exported PDF, and a wasted undo step.
test("a click with no drag leaves nothing behind", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickRectangle(page);
	await page.mouse.click(box.x + 100, box.y + 100);
	await page.waitForTimeout(500);

	expect((await exportedMarkBounds(page)).marked).toBe(0);
});

// ─── text decoration follows the glyphs ──────────────────────────────────────

// A Textbox is created 200pt wide whatever is typed into it, so drawing the
// rule across record.width ran it several times the length of the text.
test("underline is drawn under the text, not across the whole box", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await page.getByTitle("Text (T)", { exact: true }).click();
	await page.mouse.click(box.x + 60, box.y + 60);
	await page.waitForTimeout(300);
	await page.keyboard.type("HELLO");
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);

	const before = await exportedMarkBounds(page);
	await page.locator('button[title="Underline"]').first().click();
	await page.waitForTimeout(700);
	const after = await exportedMarkBounds(page);

	expect(after.marked).toBeGreaterThan(before.marked);
	// The rule may round a pixel past the glyphs; it must not run away with the box.
	expect(after.bbox[2]).toBeLessThanOrEqual(before.bbox[2] + 4);
});

// ─── export failures must not outlive themselves ─────────────────────────────

test("the export error clears once an export succeeds", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickRectangle(page);
	await drag(page, box, [50, 50], [150, 110]);

	await page.evaluate(() => {
		(window as unknown as Record<string, unknown>).__origArrayBuffer = Blob.prototype.arrayBuffer;
		Blob.prototype.arrayBuffer = () => Promise.reject(new Error("SYNTHETIC boom"));
	});
	await page.getByTitle("Export PDF", { exact: true }).click();
	await page.waitForTimeout(2500);
	await expect(page.getByText(/SYNTHETIC boom|Failed to export/i)).toHaveCount(1);

	await page.evaluate(() => {
		Blob.prototype.arrayBuffer = (window as unknown as Record<string, unknown>)
			.__origArrayBuffer as typeof Blob.prototype.arrayBuffer;
	});
	const downloaded = page.waitForEvent("download", { timeout: 30_000 });
	await page.getByTitle("Export PDF", { exact: true }).click();
	await downloaded;
	await page.waitForTimeout(1200);

	await expect(page.getByText(/SYNTHETIC boom|Failed to export/i)).toHaveCount(0);
});

// ─── putting the file away takes the draft with it ───────────────────────────

test("Change file clears the autosaved draft", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await pickRectangle(page);
	await drag(page, box, [50, 50], [150, 110]);
	await page.waitForTimeout(1200); // the save is debounced

	const readDraft = () =>
		page.evaluate(async () => {
			// @ts-expect-error -- dev-server module path
			const idb = await import("/node_modules/idb-keyval/dist/index.js");
			return (await idb.get("pdf-editor-draft")) ? "present" : "gone";
		});

	expect(await readDraft()).toBe("present");
	await page.getByRole("button", { name: "Change file", exact: true }).click();
	await page.waitForTimeout(1500);
	expect(await readDraft()).toBe("gone");
});

// ─── rotation ────────────────────────────────────────────────────────────────

// Rotation is applied to the page on export, and object coordinates stay in the
// page's own unrotated space. page.width/height start reporting the rotated box
// the moment setRotation is called, so reading them afterwards flipped every
// annotation against the wrong height and threw it off the paper.
test("an annotation on a page marked for rotation exports where it was drawn", async ({ page }) => {
	const { box } = await openEditor(page, 400, 300);
	await page.getByTitle(/rotate/i).first().click();
	await page.waitForTimeout(1000);

	// The editing surface stays upright so the pointer stays exact.
	const canvas = (await page.locator("canvas.upper-canvas").boundingBox())!;
	expect(canvas.width).toBe(400);
	expect(canvas.height).toBe(300);
	await expect(page.getByText(/exports rotated/i)).toHaveCount(1);

	await pickRectangle(page);
	await drag(page, box, [60, 60], [160, 120]);
	await page.waitForTimeout(600);

	const exported = await exportedMarkBounds(page);
	// The exported page is the rotated box...
	expect(exported.w).toBe(300);
	expect(exported.h).toBe(400);
	// ...and the rectangle rides along with the content it was drawn on:
	// page (x 60-160, y 60-120) becomes raster (x 300-y, y x).
	expectNear(exported.bbox[0], 180, 8);
	expectNear(exported.bbox[1], 60, 8);
	expectNear(exported.bbox[2], 240, 8);
	expectNear(exported.bbox[3], 160, 8);
});

import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { hasFfmpeg, mp4NoAudio, mp4WithAudio } from "./helpers/fixtures";
import { type Outcome, toBytes } from "./helpers/run-in-page";

test.skip(!hasFfmpeg(), "needs ffmpeg to build video fixtures");

/** Puts the page on the app origin so Vite will serve /src/* to page.evaluate. */
async function onApp(page: Page, route = "/video/compress") {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}

/**
 * Adds a blob to the dock buffer and waits for the async thumbnail to land,
 * then decodes the preview so the assertion is about real pixels rather than
 * about a blob URL merely existing.
 */
async function addAndProbe(
  page: Page,
  fixture: string,
  mimeType: string,
  filename: string,
  fileType?: string,
): Promise<Outcome> {
  const bytes = toBytes(readFileSync(fixture));
  return page.evaluate(
    async ({ b, mimeType, filename, fileType }) => {
      try {
        // @ts-expect-error -- dev-server module path
        const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
        const blob = new Blob([new Uint8Array(b)], { type: mimeType });

        const before = fileBufferStore.getItems().map((i: { id: string }) => i.id);
        fileBufferStore.add({
          filename,
          blob,
          mimeType,
          size: blob.size,
          sourceToolLabel: "Test",
          ...(fileType ? { fileType } : {}),
        });

        const added = fileBufferStore.getItems().find((i: { id: string }) => !before.includes(i.id));
        if (!added) return { ok: false, error: "item was not added" };

        // Thumbnail generation is fire-and-forget; poll for it.
        const deadline = Date.now() + 15_000;
        let item = added;
        while (!item.previewUrl && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
          item = fileBufferStore.getItems().find((i: { id: string }) => i.id === added.id);
          if (!item) return { ok: false, error: "item disappeared" };
        }

        if (!item.previewUrl) {
          return { ok: false, error: `no previewUrl after 15s (fileType=${item.fileType})` };
        }

        // Decode the preview and check it isn't a uniform blank frame.
        const img = new Image();
        img.src = item.previewUrl;
        await img.decode();

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const distinct = new Set<string>();
        for (let i = 0; i < data.length; i += 4) {
          distinct.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }

        fileBufferStore.remove(added.id);

        return {
          ok: true,
          fileType: item.fileType,
          width: img.naturalWidth,
          height: img.naturalHeight,
          distinctColors: distinct.size,
        };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    { b: bytes, mimeType, filename, fileType },
  );
}

test("mp4 held in the dock gets a real frame as its thumbnail", async ({ page }) => {
  await onApp(page);
  const out = await addAndProbe(page, mp4WithAudio("dock-thumb.mp4"), "video/mp4", "clip.mp4");

  expect(out.ok, out.ok ? "" : (out as { error: string }).error).toBe(true);
  if (!out.ok) return;

  // 320x240 source scaled to the dock's 80px thumbnail height.
  expect(out.fileType).toBe("video");
  expect(out.height).toBe(80);
  expect(out.width).toBe(107);
  // testsrc is a colour-bar pattern — a black or blank frame would be 1-2 colours.
  expect(out.distinctColors as number).toBeGreaterThan(10);
});

test("video mime infers the video file type when the caller omits it", async ({ page }) => {
  await onApp(page);
  const out = await addAndProbe(page, mp4NoAudio("dock-thumb-silent.mp4"), "video/mp4", "silent.mp4");

  expect(out.ok, out.ok ? "" : (out as { error: string }).error).toBe(true);
  if (!out.ok) return;
  expect(out.fileType).toBe("video");
});

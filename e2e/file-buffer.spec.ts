import { expect, test } from "@playwright/test";

test("rapid changes persist only the final files as Blobs", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    fileBufferStore.clear();
    await fileBufferStore.writeQueue;

    const first = new Blob(["first"], { type: "text/plain" });
    const second = new Blob(["second"], { type: "text/plain" });
    fileBufferStore.add({ filename: "first.txt", blob: first, mimeType: first.type, size: 1, sourceToolLabel: "Test" });
    const firstId = fileBufferStore.getItems()[0].id;
    fileBufferStore.add({
      filename: "second.txt",
      blob: second,
      mimeType: second.type,
      size: 1,
      sourceToolLabel: "Test",
    });
    fileBufferStore.remove(firstId);
    await fileBufferStore.writeQueue;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("noupload-file-buffer");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = await new Promise<Array<{ filename: string; blob: Blob; size: number }>>((resolve, reject) => {
      const request = db.transaction("items", "readonly").objectStore("items").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      names: stored.map((item) => item.filename),
      blob: stored[0]?.blob instanceof Blob,
      content: await stored[0]?.blob.text(),
      size: stored[0]?.size,
    };
  });

  expect(result).toEqual({ names: ["second.txt"], blob: true, content: "second", size: 6 });
  await page.reload();
  const names = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    return fileBufferStore.getItems().map((item: { filename: string }) => item.filename);
  });
  expect(names).toEqual(["second.txt"]);
});

test("a file added during hydration joins the existing buffer", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const names = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { FileBufferStore, fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    fileBufferStore.clear();
    const oldBlob = new Blob(["old"], { type: "text/plain" });
    fileBufferStore.add({
      filename: "old.txt",
      blob: oldBlob,
      mimeType: oldBlob.type,
      size: oldBlob.size,
      sourceToolLabel: "Test",
    });
    await fileBufferStore.writeQueue;

    const freshStore = new FileBufferStore();
    const newBlob = new Blob(["new"], { type: "text/plain" });
    freshStore.add({
      filename: "new.txt",
      blob: newBlob,
      mimeType: newBlob.type,
      size: newBlob.size,
      sourceToolLabel: "Test",
    });
    await freshStore.ready;
    await freshStore.writeQueue;
    return freshStore.getItems().map((item: { filename: string }) => item.filename);
  });
  expect(names).toEqual(["old.txt", "new.txt"]);

  await page.reload();
  const persisted = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    return fileBufferStore.getItems().map((item: { filename: string }) => item.filename);
  });
  expect(persisted).toEqual(names);
});

test("the dock can hand a file to the tool already open", async ({ page }) => {
  await page.goto("/merge", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    const blob = new Blob(["%PDF-test"], { type: "application/pdf" });
    fileBufferStore.add({
      filename: "from-dock.pdf",
      blob,
      mimeType: blob.type,
      size: blob.size,
      sourceToolLabel: "Test",
    });
    const item = fileBufferStore.getItems().at(-1);
    fileBufferStore.setPendingItem(item.id, "/merge");
  });
  await expect(page.getByText("1 file selected")).toBeVisible();
  await expect(page.getByText("from-dock.pdf").first()).toBeVisible();
});

test("legacy buffer migrates once without changing file bytes", async ({ page }) => {
  // Establish the app origin without running its JavaScript, as on a real upgrade.
  await page.goto("/favicon.svg", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keyval-store", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("keyval");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const legacy = [
      {
        id: "legacy-one",
        filename: "old.txt",
        arrayBuffer: new TextEncoder().encode("old bytes").buffer,
        mimeType: "text/plain",
        size: 9,
        fileType: "other",
        sourceToolLabel: "Test",
        createdAt: Date.now(),
      },
    ];
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("keyval", "readwrite");
      transaction.objectStore("keyval").put(legacy, "file-buffer-v1");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        // @ts-expect-error -- Vite serves this module path in the browser.
        const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
        return fileBufferStore.getItems().length;
      }),
    )
    .toBe(1);

  const result = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    const item = fileBufferStore.getItems()[0];
    const oldRecord = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open("keyval-store", 1);
      request.onsuccess = () => {
        const lookup = request.result.transaction("keyval", "readonly").objectStore("keyval").get("file-buffer-v1");
        lookup.onsuccess = () => resolve(lookup.result);
        lookup.onerror = () => reject(lookup.error);
      };
      request.onerror = () => reject(request.error);
    });
    return { name: item.filename, bytes: await item.blob.text(), oldRecord };
  });
  expect(result).toEqual({ name: "old.txt", bytes: "old bytes", oldRecord: undefined });

  // Simulate cleanup failing and leaving the old key behind after a user clears the buffer.
  await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    fileBufferStore.clear();
    await fileBufferStore.writeQueue;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keyval-store", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("keyval", "readwrite");
      transaction.objectStore("keyval").put(
        [
          {
            id: "legacy-one",
            filename: "old.txt",
            arrayBuffer: new TextEncoder().encode("old bytes").buffer,
            mimeType: "text/plain",
            size: 9,
            fileType: "other",
            sourceToolLabel: "Test",
            createdAt: Date.now(),
          },
        ],
        "file-buffer-v1",
      );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  const afterClear = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    return fileBufferStore.getItems().length;
  });
  expect(afterClear).toBe(0);
});

test("an oversized file cannot evict a buffered file", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    // @ts-expect-error -- Vite serves this module path in the browser.
    const { fileBufferStore } = await import("/src/lib/file-buffer/store.ts");
    await fileBufferStore.ready;
    fileBufferStore.clear();
    const small = new Blob(["keep"], { type: "text/plain" });
    fileBufferStore.add({ filename: "keep.txt", blob: small, mimeType: small.type, size: 4, sourceToolLabel: "Test" });
    const oversized = new Blob(["x"]);
    Object.defineProperty(oversized, "size", { value: 200 * 1024 * 1024 + 1 });
    const add = fileBufferStore.add({
      filename: "too-big.bin",
      blob: oversized,
      mimeType: "application/octet-stream",
      size: oversized.size,
      sourceToolLabel: "Test",
    });
    return { add, names: fileBufferStore.getItems().map((item: { filename: string }) => item.filename) };
  });
  expect(result.add.ok).toBe(false);
  expect(result.names).toEqual(["keep.txt"]);
  await expect(page.getByRole("alert")).toContainText("exceeds the 200 MB buffer limit");
});

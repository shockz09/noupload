import type { ElementHandle, Page } from "@playwright/test";

/**
 * FileDropzone builds its <input type="file"> on click via document.createElement
 * (see src/components/pdf/file-dropzone.tsx), so there is no input in the DOM to
 * locate or setInputFiles on. Everything here goes through the filechooser event
 * instead, which is what the browser fires for that dynamically-created input.
 */

function dropzone(page: Page) {
	// Non-compact dropzone carries .dropzone; the compact variant is a bare role=button.
	return page.locator('.dropzone, [role="button"]').first();
}

/** Clicks the dropzone and sets files on the input it creates. */
export async function uploadFiles(page: Page, files: string | string[]) {
	const chooserPromise = page.waitForEvent("filechooser");
	await dropzone(page).click();
	const chooser = await chooserPromise;
	await chooser.setFiles(files);
}

/**
 * Reads the `accept` attribute off the input the dropzone creates on click.
 * Cancels the picker afterwards so the page is left untouched.
 */
export async function getDropzoneAccept(page: Page): Promise<string | null> {
	const chooserPromise = page.waitForEvent("filechooser");
	await dropzone(page).click();
	const chooser = await chooserPromise;
	const element = chooser.element() as ElementHandle<HTMLInputElement>;
	const accept = await element.getAttribute("accept");
	// Dismiss without picking anything — leaves no file selected.
	await chooser.setFiles([]);
	return accept;
}

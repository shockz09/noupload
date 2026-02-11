/**
 * Download utilities for browser file operations
 * Centralizes all download patterns used across the app
 */

/**
 * Download a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	try {
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Download text content as a file
 */
export function downloadText(text: string, filename: string, type = "text/plain"): void {
	const blob = new Blob([text], { type });
	downloadBlob(blob, filename);
}

/**
 * Download a URL (data URL or object URL) as a file
 */
export function downloadFile(url: string, filename: string): void {
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

/**
 * Trigger download with stagger for multiple files (prevents browser blocking)
 */
export async function downloadMultiple(
	items: Array<{ blob: Blob; filename: string }>,
	delay = 100,
): Promise<void> {
	for (const { blob, filename } of items) {
		downloadBlob(blob, filename);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

// Centralized pdfjs-dist configuration
// Using explicit https:// to work in both dev (http://localhost) and prod (https://)

export const getPdfjsWorkerSrc = (version: string) =>
	`https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

/**
 * Load and initialize pdfjs-dist with proper worker configuration
 * Returns the initialized pdfjsLib for immediate use
 * 
 * Usage:
 *   const pdfjsLib = await loadPdfjs();
 *   const pdf = await pdfjsLib.getDocument(...).promise;
 */
export async function loadPdfjs() {
	const pdfjsLib = await import("pdfjs-dist");
	pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc(pdfjsLib.version);
	return pdfjsLib;
}

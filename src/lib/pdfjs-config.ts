// Centralized pdfjs-dist configuration
// Using explicit https:// to work in both dev (http://localhost) and prod (https://)

export const getPdfjsWorkerSrc = (version: string) =>
	`https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

/**
 * Error handling utilities
 * Centralizes error message extraction patterns
 */

/**
 * Extract a user-friendly error message from an unknown error value
 * Used throughout the app for consistent error handling
 */
export function getErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof Error) {
		return err.message;
	}
	if (typeof err === "string") {
		return err;
	}
	return fallback;
}

/**
 * Extract error message with specific prefix for debugging
 */
export function getErrorMessageWithPrefix(err: unknown, operation: string): string {
	return getErrorMessage(err, `${operation} failed`);
}

/**
 * Common error messages for reuse across tools
 */
export const ErrorMessages = {
	PDF_SPLIT: "Failed to split PDF",
	PDF_MERGE: "Failed to merge PDFs",
	PDF_ROTATE: "Failed to rotate PDF",
	PDF_COMPRESS: "Failed to compress PDF",
	PDF_DELETE: "Failed to process PDF",
	PDF_ORGANIZE: "Failed to organize PDF",
	PDF_ENCRYPT: "Failed to encrypt PDF",
	PDF_DECRYPT: "Failed to decrypt PDF",
	PDF_EXTRACT_IMAGES: "Failed to extract images",
	PDF_EXTRACT_TEXT: "Failed to extract text",
	PDF_TO_EPUB: "Failed to convert PDF to EPUB",
	PDF_OCR: "OCR processing failed",
	PDF_SANITIZE: "Failed to sanitize PDF",
	PDF_TO_PDFA: "Failed to convert PDF",
	PDF_METADATA: "Failed to update metadata",
	PDF_WATERMARK: "Failed to add watermark",
	PDF_PAGE_NUMBERS: "Failed to add page numbers",
	PDF_REVERSE: "Failed to reverse PDF",
	PDF_DUPLICATE: "Failed to duplicate pages",
	PDF_GRAYSCALE: "Failed to convert PDF",
	PDF_SIGN: "Failed to sign PDF",
	PDF_EDIT: "Failed to edit PDF",

	IMAGE_PROCESS: "Failed to process image",
	IMAGE_CONVERT: "Failed to convert image",
	IMAGE_RESIZE: "Failed to resize image",
	IMAGE_COMPRESS: "Failed to compress image",
	IMAGE_CROP: "Failed to crop image",
	IMAGE_WATERMARK: "Failed to add watermark",
	IMAGE_FILTER: "Failed to apply filter",

	AUDIO_PROCESS: "Failed to process audio",
	AUDIO_CONVERT: "Failed to convert audio",
	AUDIO_TRIM: "Failed to trim audio",
	AUDIO_MERGE: "Failed to merge audio",

	QR_GENERATE: "Failed to generate QR code",
	QR_SCAN: "Failed to access camera. Please allow camera permissions.",
	QR_BULK_DOWNLOAD: "Failed to download QR codes",

	UNKNOWN: "An unexpected error occurred",
} as const;

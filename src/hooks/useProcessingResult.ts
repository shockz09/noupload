"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic processing result with blob data.
 */
export interface ProcessingResult<TMetadata = Record<string, unknown>> {
	blob: Blob;
	filename: string;
	url: string;
	metadata?: TMetadata;
}

interface UseProcessingResultReturn<TMetadata> {
	result: ProcessingResult<TMetadata> | null;
	setResult: (blob: Blob, filename: string, metadata?: TMetadata) => void;
	clearResult: () => void;
	download: () => void;
}

/**
 * Generic hook for managing processing results with automatic URL lifecycle.
 * Works for any file type (images, audio, PDFs, etc.).
 *
 * Eliminates duplicated result state + download logic across 50+ pages.
 *
 * Usage:
 * ```tsx
 * const { result, setResult, clearResult, download } = useProcessingResult<ImageMetadata>();
 *
 * // After processing:
 * setResult(processedBlob, "output.png", { originalSize: file.size, newSize: blob.size });
 *
 * // In SuccessCard:
 * <SuccessCard onDownload={download} onStartOver={clearResult}>
 *   {result && <img src={result.url} />}
 *   {result?.metadata && <span>Saved {result.metadata.savedBytes} bytes</span>}
 * </SuccessCard>
 * ```
 */
export function useProcessingResult<
	TMetadata = Record<string, unknown>,
>(): UseProcessingResultReturn<TMetadata> {
	const [result, setResultState] = useState<ProcessingResult<TMetadata> | null>(
		null,
	);
	const urlRef = useRef<string | null>(null);

	// Cleanup URL on unmount
	useEffect(() => {
		return () => {
			if (urlRef.current) {
				URL.revokeObjectURL(urlRef.current);
				urlRef.current = null;
			}
		};
	}, []);

	const setResult = useCallback(
		(blob: Blob, filename: string, metadata?: TMetadata) => {
			// Revoke previous URL if exists
			if (urlRef.current) {
				URL.revokeObjectURL(urlRef.current);
			}

			const url = URL.createObjectURL(blob);
			urlRef.current = url;
			setResultState({ blob, filename, url, metadata });
		},
		[],
	);

	const clearResult = useCallback(() => {
		if (urlRef.current) {
			URL.revokeObjectURL(urlRef.current);
			urlRef.current = null;
		}
		setResultState(null);
	}, []);

	const download = useCallback(() => {
		if (!result) return;

		const a = document.createElement("a");
		a.href = result.url;
		a.download = result.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}, [result]);

	return { result, setResult, clearResult, download };
}

/**
 * Specialized version for image processing results.
 */
export interface ImageResultMetadata {
	originalSize: number;
	newSize: number;
	width?: number;
	height?: number;
	format?: string;
}

export function useImageResult() {
	return useProcessingResult<ImageResultMetadata>();
}

/**
 * Specialized version for PDF processing results.
 */
export interface PdfResultMetadata {
	originalSize?: number;
	pageCount?: number;
	originalPageCount?: number;
}

export function usePdfResult() {
	return useProcessingResult<PdfResultMetadata>();
}

/**
 * Version that uses Uint8Array for PDF-lib compatibility.
 */
export interface PdfDataResult<TMetadata = Record<string, unknown>> {
	data: Uint8Array;
	filename: string;
	metadata?: TMetadata;
}

interface UsePdfDataResultReturn<TMetadata> {
	result: PdfDataResult<TMetadata> | null;
	setResult: (data: Uint8Array, filename: string, metadata?: TMetadata) => void;
	clearResult: () => void;
	download: () => void;
}

/**
 * Hook for PDF results using Uint8Array (compatible with pdf-lib).
 *
 * Usage:
 * ```tsx
 * const { result, setResult, clearResult, download } = usePdfDataResult();
 *
 * // After merging:
 * setResult(mergedPdfBytes, "merged.pdf", { pageCount: 10 });
 *
 * // Download:
 * <button onClick={download}>Download</button>
 * ```
 */
export function usePdfDataResult<
	TMetadata = Record<string, unknown>,
>(): UsePdfDataResultReturn<TMetadata> {
	const [result, setResultState] = useState<PdfDataResult<TMetadata> | null>(
		null,
	);

	const setResult = useCallback(
		(data: Uint8Array, filename: string, metadata?: TMetadata) => {
			setResultState({ data, filename, metadata });
		},
		[],
	);

	const clearResult = useCallback(() => {
		setResultState(null);
	}, []);

	const download = useCallback(() => {
		if (!result) return;

		const blob = new Blob([new Uint8Array(result.data)], { type: "application/pdf" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = result.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [result]);

	return { result, setResult, clearResult, download };
}

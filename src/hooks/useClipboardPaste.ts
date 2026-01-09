"use client";

import { useCallback, useEffect } from "react";

export type FileFilter = (file: File) => boolean;

/**
 * Built-in file type filters for common use cases.
 */
export const FileFilters = {
	image: (file: File) => file.type.startsWith("image/"),
	audio: (file: File) => file.type.startsWith("audio/"),
	video: (file: File) => file.type.startsWith("video/"),
	pdf: (file: File) => file.type === "application/pdf",
	any: () => true,
} as const;

interface UseClipboardPasteOptions {
	/** Filter function to determine which files to accept */
	filter?: FileFilter;
	/** Whether the paste handler is enabled (default: true) */
	enabled?: boolean;
}

/**
 * Hook for handling clipboard paste events for files.
 * Eliminates duplicated paste handlers across 30+ image/audio pages.
 *
 * Usage:
 * ```tsx
 * // Accept only images:
 * useClipboardPaste(handleFileSelected, { filter: FileFilters.image });
 *
 * // Accept any file:
 * useClipboardPaste(handleFileSelected, { filter: FileFilters.any });
 *
 * // Custom filter:
 * useClipboardPaste(handleFileSelected, {
 *   filter: (file) => file.type === 'image/png'
 * });
 *
 * // Disable when result is shown:
 * useClipboardPaste(handleFileSelected, {
 *   filter: FileFilters.image,
 *   enabled: !result
 * });
 * ```
 */
export function useClipboardPaste(
	onFilePasted: (files: File[]) => void,
	options: UseClipboardPasteOptions = {},
) {
	const { filter = FileFilters.any, enabled = true } = options;

	const handlePaste = useCallback(
		(e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const files: File[] = [];
			for (const item of items) {
				if (item.kind === "file") {
					const file = item.getAsFile();
					if (file && filter(file)) {
						files.push(file);
					}
				}
			}

			if (files.length > 0) {
				onFilePasted(files);
			}
		},
		[onFilePasted, filter],
	);

	useEffect(() => {
		if (!enabled) return;

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [handlePaste, enabled]);
}

/**
 * Hook specifically for image paste (most common use case).
 */
export function useImagePaste(
	onImagePasted: (files: File[]) => void,
	enabled = true,
) {
	useClipboardPaste(onImagePasted, {
		filter: FileFilters.image,
		enabled,
	});
}

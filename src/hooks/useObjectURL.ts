"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for managing Object URL lifecycle with automatic cleanup.
 * Prevents memory leaks from unreleased blob URLs.
 *
 * Usage:
 * ```tsx
 * const { url, setSource, revoke } = useObjectURL();
 *
 * // When file is selected:
 * setSource(file); // or setSource(blob)
 *
 * // Use in img/video/audio:
 * <img src={url} />
 *
 * // Manual cleanup (optional - auto-cleans on unmount):
 * revoke();
 * ```
 */
export function useObjectURL() {
	const [url, setUrl] = useState<string | null>(null);
	const urlRef = useRef<string | null>(null);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (urlRef.current) {
				URL.revokeObjectURL(urlRef.current);
				urlRef.current = null;
			}
		};
	}, []);

	const setSource = useCallback((source: Blob | File | null) => {
		// Revoke previous URL if exists
		if (urlRef.current) {
			URL.revokeObjectURL(urlRef.current);
			urlRef.current = null;
		}

		if (source) {
			const newUrl = URL.createObjectURL(source);
			urlRef.current = newUrl;
			setUrl(newUrl);
		} else {
			setUrl(null);
		}
	}, []);

	const revoke = useCallback(() => {
		if (urlRef.current) {
			URL.revokeObjectURL(urlRef.current);
			urlRef.current = null;
		}
		setUrl(null);
	}, []);

	return { url, setSource, revoke };
}

/**
 * Hook for managing multiple Object URLs (for multi-file scenarios).
 *
 * Usage:
 * ```tsx
 * const { urls, addSource, removeSource, clear } = useObjectURLs();
 *
 * // When files are added:
 * files.forEach(file => addSource(file.id, file));
 *
 * // Access URL by ID:
 * urls.get(fileId)
 *
 * // Remove specific:
 * removeSource(fileId);
 *
 * // Clear all:
 * clear();
 * ```
 */
export function useObjectURLs() {
	const [urls, setUrls] = useState<Map<string, string>>(new Map());
	const urlsRef = useRef<Map<string, string>>(new Map());

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
			urlsRef.current.clear();
		};
	}, []);

	const addSource = useCallback((id: string, source: Blob | File) => {
		// Revoke existing URL for this ID if any
		const existing = urlsRef.current.get(id);
		if (existing) {
			URL.revokeObjectURL(existing);
		}

		const newUrl = URL.createObjectURL(source);
		urlsRef.current.set(id, newUrl);
		setUrls(new Map(urlsRef.current));

		return newUrl;
	}, []);

	const removeSource = useCallback((id: string) => {
		const existing = urlsRef.current.get(id);
		if (existing) {
			URL.revokeObjectURL(existing);
			urlsRef.current.delete(id);
			setUrls(new Map(urlsRef.current));
		}
	}, []);

	const clear = useCallback(() => {
		urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
		urlsRef.current.clear();
		setUrls(new Map());
	}, []);

	const getUrl = useCallback((id: string) => {
		return urlsRef.current.get(id) ?? null;
	}, []);

	return { urls, addSource, removeSource, clear, getUrl };
}

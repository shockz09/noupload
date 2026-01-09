"use client";

import { useCallback, useRef, useState } from "react";

export interface ProcessingState {
	isProcessing: boolean;
	progress: number;
	error: string | null;
}

export interface UseFileProcessingOptions {
	/** Initial progress value (default: 0) */
	initialProgress?: number;
}

/**
 * Hook for managing file processing state: loading, progress, and errors.
 * Eliminates ~500 lines of duplicated state management across 50+ pages.
 *
 * Usage:
 * ```tsx
 * const { state, startProcessing, setProgress, setError, reset } = useFileProcessing();
 *
 * const handleProcess = async () => {
 *   const canStart = startProcessing();
 *   if (!canStart) return; // Already processing
 *
 *   try {
 *     setProgress(30);
 *     const result = await doWork();
 *     setProgress(100);
 *     return result;
 *   } catch (err) {
 *     setError(err instanceof Error ? err.message : "Failed");
 *   }
 * };
 *
 * // In JSX:
 * {state.isProcessing && <ProgressBar progress={state.progress} />}
 * {state.error && <ErrorBox message={state.error} />}
 * ```
 */
export function useFileProcessing(options: UseFileProcessingOptions = {}) {
	const { initialProgress = 0 } = options;

	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgressState] = useState(initialProgress);
	const [error, setErrorState] = useState<string | null>(null);

	// Ref to prevent double-processing
	const processingRef = useRef(false);

	/**
	 * Start processing. Returns true if started, false if already processing.
	 * Automatically clears previous errors.
	 */
	const startProcessing = useCallback(() => {
		if (processingRef.current) return false;

		processingRef.current = true;
		setIsProcessing(true);
		setProgressState(0);
		setErrorState(null);
		return true;
	}, []);

	/**
	 * Stop processing (call in finally block or after completion).
	 */
	const stopProcessing = useCallback(() => {
		processingRef.current = false;
		setIsProcessing(false);
	}, []);

	/**
	 * Set current progress (0-100).
	 */
	const setProgress = useCallback((value: number) => {
		setProgressState(Math.min(100, Math.max(0, value)));
	}, []);

	/**
	 * Set error message and stop processing.
	 */
	const setError = useCallback((message: string) => {
		setErrorState(message);
		processingRef.current = false;
		setIsProcessing(false);
	}, []);

	/**
	 * Clear error without affecting processing state.
	 */
	const clearError = useCallback(() => {
		setErrorState(null);
	}, []);

	/**
	 * Reset all state to initial values.
	 */
	const reset = useCallback(() => {
		processingRef.current = false;
		setIsProcessing(false);
		setProgressState(initialProgress);
		setErrorState(null);
	}, [initialProgress]);

	/**
	 * Execute an async function with automatic state management.
	 * Handles start, progress updates, error catching, and cleanup.
	 */
	const execute = useCallback(
		async <T>(
			fn: (setProgress: (value: number) => void) => Promise<T>,
			errorMessage = "Operation failed",
		): Promise<T | null> => {
			if (!startProcessing()) return null;

			try {
				const result = await fn(setProgress);
				setProgressState(100);
				return result;
			} catch (err) {
				setError(err instanceof Error ? err.message : errorMessage);
				return null;
			} finally {
				stopProcessing();
			}
		},
		[startProcessing, setProgress, setError, stopProcessing],
	);

	return {
		// State
		isProcessing,
		progress,
		error,
		state: { isProcessing, progress, error } as ProcessingState,

		// Actions
		startProcessing,
		stopProcessing,
		setProgress,
		setError,
		clearError,
		reset,
		execute,
	};
}

/**
 * Simplified version that returns state object for easy spreading.
 * Useful when you just need the basic state management.
 */
export function useProcessingState() {
	const {
		isProcessing,
		progress,
		error,
		startProcessing,
		stopProcessing,
		setProgress,
		setError,
		reset,
	} = useFileProcessing();

	return {
		isProcessing,
		progress,
		error,
		startProcessing,
		stopProcessing,
		setProgress,
		setError,
		reset,
	};
}

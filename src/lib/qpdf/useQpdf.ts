import { useCallback, useEffect, useRef, useState } from "react";
import { ERROR_MESSAGES, MAX_FILE_SIZE } from "./constants";
import type {
	QpdfDecryptOptions,
	QpdfEncryptOptions,
	QpdfState,
	QpdfWorkerMessage,
	QpdfWorkerResponse,
} from "./types";

let workerInstance: Worker | null = null;
let workerRefCount = 0;

// Get or create singleton worker
function getWorker(): Worker {
	if (!workerInstance) {
		workerInstance = new Worker(new URL("./qpdf.worker.ts", import.meta.url), {
			type: "module",
		});
	}
	workerRefCount++;
	return workerInstance;
}

// Release worker reference
function releaseWorker(): void {
	workerRefCount--;
	if (workerRefCount <= 0 && workerInstance) {
		workerInstance.terminate();
		workerInstance = null;
		workerRefCount = 0;
	}
}

// Generate unique ID
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useQpdf() {
	const [state, setState] = useState<QpdfState>({
		isLoading: false,
		isProcessing: false,
		progress: 0,
		error: null,
	});

	const workerRef = useRef<Worker | null>(null);
	const pendingRef = useRef<
		Map<
			string,
			{
				resolve: (data: Uint8Array) => void;
				reject: (error: Error) => void;
			}
		>
	>(new Map());

	// Initialize worker on mount
	useEffect(() => {
		workerRef.current = getWorker();

		// Handle worker messages
		const handleMessage = (event: MessageEvent<QpdfWorkerResponse>) => {
			const { id, success, data, error, errorCode } = event.data;
			const pending = pendingRef.current.get(id);

			if (!pending) return;
			pendingRef.current.delete(id);

			setState((s) => ({ ...s, isProcessing: false, progress: 100 }));

			if (success && data) {
				pending.resolve(data);
			} else {
				const errorMsg = errorCode
					? ERROR_MESSAGES[errorCode]
					: error || "Unknown error";
				pending.reject(new Error(errorMsg));
			}
		};

		workerRef.current.addEventListener("message", handleMessage);

		return () => {
			workerRef.current?.removeEventListener("message", handleMessage);
			releaseWorker();
		};
	}, []);

	// Send operation to worker
	const sendOperation = useCallback(
		async (
			operation: QpdfWorkerMessage["operation"],
			file: File,
			options?: QpdfEncryptOptions | QpdfDecryptOptions,
		): Promise<Uint8Array> => {
			// Validate file size
			if (file.size > MAX_FILE_SIZE) {
				throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
			}

			if (!workerRef.current) {
				throw new Error(ERROR_MESSAGES.WORKER_INIT_FAILED);
			}

			setState((s) => ({
				...s,
				isProcessing: true,
				progress: 10,
				error: null,
			}));

			// Read file
			const arrayBuffer = await file.arrayBuffer();
			const inputData = new Uint8Array(arrayBuffer);

			setState((s) => ({ ...s, progress: 30 }));

			// Create promise for this operation
			const id = generateId();

			return new Promise((resolve, reject) => {
				pendingRef.current.set(id, { resolve, reject });

				// Simulate progress (qpdf doesn't provide real progress)
				const progressInterval = setInterval(() => {
					setState((s) => {
						if (s.progress < 90) {
							return { ...s, progress: s.progress + 10 };
						}
						clearInterval(progressInterval);
						return s;
					});
				}, 500);

				// Send to worker
				const message: QpdfWorkerMessage = {
					id,
					operation,
					inputData,
					options,
				};
				workerRef.current!.postMessage(message, [inputData.buffer]);

				// Wrap handlers to cleanup interval on completion
				const originalResolve = resolve;
				const originalReject = reject;

				pendingRef.current.set(id, {
					resolve: (data) => {
						clearInterval(progressInterval);
						originalResolve(data);
					},
					reject: (error) => {
						clearInterval(progressInterval);
						setState((s) => ({ ...s, error: error.message }));
						originalReject(error);
					},
				});
			});
		},
		[],
	);

	// Public API
	const encrypt = useCallback(
		async (file: File, options: QpdfEncryptOptions): Promise<Uint8Array> => {
			return sendOperation("encrypt", file, options);
		},
		[sendOperation],
	);

	const decrypt = useCallback(
		async (file: File, password: string): Promise<Uint8Array> => {
			return sendOperation("decrypt", file, { password });
		},
		[sendOperation],
	);

	const repair = useCallback(
		async (file: File): Promise<Uint8Array> => {
			return sendOperation("repair", file);
		},
		[sendOperation],
	);

	const linearize = useCallback(
		async (file: File): Promise<Uint8Array> => {
			return sendOperation("linearize", file);
		},
		[sendOperation],
	);

	const clearError = useCallback(() => {
		setState((s) => ({ ...s, error: null }));
	}, []);

	return {
		...state,
		encrypt,
		decrypt,
		repair,
		linearize,
		clearError,
	};
}

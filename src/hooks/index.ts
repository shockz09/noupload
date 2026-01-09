// Audio hooks
export { useAudioResult } from "./useAudioResult";
export { type ExtractionState, useVideoToAudio } from "./useVideoToAudio";

// Generic processing hooks
export {
	useFileProcessing,
	useProcessingState,
	type ProcessingState,
	type UseFileProcessingOptions,
} from "./useFileProcessing";

export {
	useProcessingResult,
	useImageResult,
	usePdfResult,
	usePdfDataResult,
	type ProcessingResult,
	type ImageResultMetadata,
	type PdfResultMetadata,
	type PdfDataResult,
} from "./useProcessingResult";

// URL lifecycle management
export { useObjectURL, useObjectURLs } from "./useObjectURL";

// Clipboard handling
export {
	useClipboardPaste,
	useImagePaste,
	FileFilters,
	type FileFilter,
} from "./useClipboardPaste";

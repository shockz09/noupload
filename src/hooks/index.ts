// Audio hooks
export { useAudioResult } from "./useAudioResult";
// Clipboard handling
export {
  type FileFilter,
  FileFilters,
  useClipboardPaste,
  useImagePaste,
} from "./useClipboardPaste";

// Generic processing hooks
export {
  type ProcessingState,
  type UseFileProcessingOptions,
  useFileProcessing,
  useProcessingState,
} from "./useFileProcessing";
// URL lifecycle management
export { useObjectURL, useObjectURLs } from "./useObjectURL";
export {
  type ImageResultMetadata,
  type PdfDataResult,
  type PdfResultMetadata,
  type ProcessingResult,
  useImageResult,
  usePdfDataResult,
  usePdfResult,
  useProcessingResult,
} from "./useProcessingResult";
export { type ExtractionState, useVideoToAudio } from "./useVideoToAudio";

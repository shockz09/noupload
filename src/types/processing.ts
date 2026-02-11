/**
 * Centralized type definitions for file processing operations.
 * Eliminates duplicate interface definitions scattered across 50+ page files.
 */

// =============================================================================
// Generic Processing Types
// =============================================================================

/**
 * Base result interface for any file processing operation.
 */
export interface BaseProcessingResult {
  filename: string;
}

/**
 * Result with Blob data (for images, audio, etc.)
 */
export interface BlobResult extends BaseProcessingResult {
  blob: Blob;
}

/**
 * Result with Uint8Array data (for PDF-lib operations)
 */
export interface DataResult extends BaseProcessingResult {
  data: Uint8Array;
}

// =============================================================================
// PDF Processing Types
// =============================================================================

/**
 * Result from PDF split operation.
 */
export interface SplitResult {
  files: Array<{
    data: Uint8Array;
    filename: string;
    pageCount: number;
  }>;
  originalPageCount: number;
}

/**
 * Result from PDF rotation operation.
 */
export interface RotateResult extends DataResult {
  rotationDegrees: number;
  pageCount?: number;
}

/**
 * Result from PDF compression operation.
 */
export interface CompressResult extends DataResult {
  originalSize: number;
  compressedSize: number;
}

/**
 * Result from PDF watermark operation.
 */
export interface WatermarkResult extends DataResult {
  pageCount: number;
}

// =============================================================================
// Image Processing Types
// =============================================================================

/**
 * Result from image compression operation.
 */
export interface ImageCompressResult extends BlobResult {
  originalSize: number;
  compressedSize: number;
}

/**
 * Result from image resize operation.
 */
export interface ImageResizeResult extends BlobResult {
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
}

/**
 * Result from image conversion operation.
 */
export interface ImageConvertResult extends BlobResult {
  originalFormat: string;
  newFormat: string;
}

/**
 * Result from image filter/adjust operation.
 */
export interface ImageFilterResult extends BlobResult {
  filter?: string;
  adjustments?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
}

/**
 * Result from image rotation operation.
 */
export interface ImageRotateResult extends BlobResult {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/**
 * Result from image border addition.
 */
export interface ImageBorderResult extends BlobResult {
  borderWidth: number;
  borderColor: string;
}

// =============================================================================
// Audio Processing Types
// =============================================================================

/**
 * Result from audio conversion operation.
 */
export interface AudioConvertResult extends BlobResult {
  originalFormat: string;
  newFormat: string;
  duration?: number;
}

/**
 * Result from audio extraction from video.
 */
export interface AudioExtractResult extends BlobResult {
  sourceVideo: string;
  duration?: number;
}

// =============================================================================
// QR Code Types
// =============================================================================

/**
 * Result from QR code generation.
 */
export interface QrGenerateResult extends BlobResult {
  data: string;
  format: string;
}

/**
 * Result from QR code scan.
 */
export interface QrScanResult {
  text: string;
  format: string;
  isUrl: boolean;
}

// =============================================================================
// File Item Types (for multi-file operations)
// =============================================================================

/**
 * Generic file item with ID for list operations.
 */
export interface FileItem {
  file: File;
  id: string;
}

/**
 * File item with preview URL.
 */
export interface FileItemWithPreview extends FileItem {
  preview?: string;
}

/**
 * Page item for PDF page manipulation.
 */
export interface PageItem {
  id: string;
  pageNumber: number;
  preview?: string;
  selected?: boolean;
}

/**
 * Duplicate page item for PDF duplication.
 */
export interface DuplicatePageItem extends PageItem {
  isDuplicate: boolean;
  originalPageNumber: number;
}

// =============================================================================
// Processing Options Types
// =============================================================================

/**
 * Image compression options.
 */
export interface ImageCompressOptions {
  quality: number; // 0-100
  format?: "jpeg" | "png" | "webp";
}

/**
 * Image resize options.
 */
export interface ImageResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  fit?: "contain" | "cover" | "fill";
}

/**
 * PDF compression options.
 */
export interface PdfCompressOptions {
  quality?: "low" | "medium" | "high";
  removeMetadata?: boolean;
}

/**
 * Audio conversion options.
 */
export interface AudioConvertOptions {
  format: string;
  bitrate?: number;
  sampleRate?: number;
}

// =============================================================================
// State Types
// =============================================================================

/**
 * Common processing state.
 */
export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
}

/**
 * File selection state.
 */
export interface FileSelectionState {
  file: File | null;
  preview: string | null;
}

/**
 * Multi-file selection state.
 */
export interface MultiFileSelectionState {
  files: FileItem[];
  previews: Map<string, string>;
}

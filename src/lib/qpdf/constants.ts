// qpdf-wasm is installed as npm dependency
// Worker will import from node_modules

// Virtual filesystem paths
export const INPUT_PATH = "/input/document.pdf";
export const OUTPUT_PATH = "/output/result.pdf";

// Error messages (user-friendly)
export const ERROR_MESSAGES: Record<string, string> = {
  WRONG_PASSWORD: "Incorrect password. Please try again.",
  CORRUPTED_FILE: "This PDF file appears to be corrupted.",
  FILE_TOO_LARGE: "File is too large. Maximum size is 100MB.",
  WORKER_INIT_FAILED: "Failed to initialize PDF processor. Please refresh the page.",
  PROCESSING_FAILED: "Failed to process PDF. Please try a different file.",
  ALREADY_ENCRYPTED: "This PDF is already encrypted.",
  NOT_ENCRYPTED: "This PDF is not password protected.",
  UNKNOWN: "An unknown error occurred.",
};

// Limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

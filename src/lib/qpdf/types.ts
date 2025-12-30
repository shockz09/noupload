export type QpdfOperation =
  | 'encrypt'
  | 'decrypt'
  | 'repair'
  | 'linearize'
  | 'check';

export interface QpdfEncryptOptions {
  userPassword: string;      // Password to open PDF (can be empty for owner-only)
  ownerPassword: string;     // Password for full permissions
  keyLength: 128 | 256;      // AES encryption strength
  permissions?: {
    print?: boolean;
    modify?: boolean;
    copy?: boolean;
    annotate?: boolean;
  };
}

export interface QpdfDecryptOptions {
  password: string;          // User or owner password
}

export interface QpdfWorkerMessage {
  id: string;                // Unique operation ID for correlation
  operation: QpdfOperation;
  inputData: Uint8Array;
  options?: QpdfEncryptOptions | QpdfDecryptOptions;
}

export interface QpdfWorkerResponse {
  id: string;
  success: boolean;
  data?: Uint8Array;
  error?: string;
  errorCode?: 'WRONG_PASSWORD' | 'CORRUPTED_FILE' | 'NOT_ENCRYPTED' | 'ALREADY_ENCRYPTED' | 'UNKNOWN';
}

export interface QpdfState {
  isLoading: boolean;        // WASM module loading
  isProcessing: boolean;     // Operation in progress
  progress: number;          // 0-100 (estimated)
  error: string | null;
}

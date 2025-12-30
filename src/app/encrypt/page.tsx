"use client";

import { useState, useCallback, useRef } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PasswordInput } from "@/components/pdf/PasswordInput";
import { useQpdf } from "@/lib/qpdf";
import { downloadBlob } from "@/lib/pdf-utils";
import { formatFileSize } from "@/lib/utils";
import { LockIcon, PdfIcon } from "@/components/icons";
import { PdfPageHeader, ErrorBox, ProgressBar, SuccessCard, PdfFileInfo } from "@/components/pdf/shared";

interface EncryptResult {
  data: Uint8Array;
  filename: string;
}

export default function EncryptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [result, setResult] = useState<EncryptResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const { encrypt, isProcessing, progress, error: qpdfError, clearError } = useQpdf();

  const error = localError || qpdfError;

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setLocalError(null);
      setResult(null);
      clearError();
    }
  }, [clearError]);

  const handleClear = useCallback(() => {
    setFile(null);
    setLocalError(null);
    setResult(null);
    setUserPassword("");
    setOwnerPassword("");
    setConfirmPassword("");
    clearError();
  }, [clearError]);

  const validateForm = (): string | null => {
    if (!ownerPassword) {
      return "Owner password is required";
    }
    if (ownerPassword.length < 4) {
      return "Password must be at least 4 characters";
    }
    if (ownerPassword !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleEncrypt = async () => {
    if (!file || processingRef.current) return;

    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    processingRef.current = true;
    setLocalError(null);

    try {
      const data = await encrypt(file, {
        userPassword,
        ownerPassword,
        keyLength: 256,
        permissions: {
          print: true,
          modify: false,
          copy: false,
          annotate: false,
        },
      });

      const baseName = file.name.replace(/\.pdf$/i, "");
      setResult({
        data,
        filename: `${baseName}_protected.pdf`,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to encrypt PDF");
    } finally {
      processingRef.current = false;
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (result) {
      downloadBlob(result.data, result.filename);
    }
  };

  const handleStartOver = () => {
    setFile(null);
    setResult(null);
    setLocalError(null);
    setUserPassword("");
    setOwnerPassword("");
    setConfirmPassword("");
    clearError();
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<LockIcon className="w-7 h-7" />}
        iconClass="tool-security"
        title="Encrypt PDF"
        description="Add password protection to your PDF documents"
      />

      {result ? (
        <SuccessCard
          stampText="Protected"
          title="PDF Encrypted!"
          downloadLabel="Download Protected PDF"
          onDownload={handleDownload}
          onStartOver={handleStartOver}
          startOverLabel="Encrypt Another"
        >
          <div className="text-center text-sm text-muted-foreground">
            Your PDF is now password protected
          </div>
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          <div className="info-box">
            <svg className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">How it works</p>
              <p className="text-muted-foreground">
                Set a password to protect your PDF. The user password is required to open the file.
                The owner password grants full editing permissions.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<PdfIcon className="w-5 h-5" />}
          />

          <div className="border-2 border-foreground/20 rounded-lg p-6 space-y-5">
            <PasswordInput
              id="userPassword"
              label="User Password (to open)"
              value={userPassword}
              onChange={setUserPassword}
              placeholder="Leave empty if no password to open"
              hint="Optional. Password required to open the PDF."
              disabled={isProcessing}
            />

            <PasswordInput
              id="ownerPassword"
              label="Owner Password"
              value={ownerPassword}
              onChange={setOwnerPassword}
              placeholder="Enter owner password"
              hint="Required. Grants full permissions to edit/print."
              required
              disabled={isProcessing}
            />

            <PasswordInput
              id="confirmPassword"
              label="Confirm Owner Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm owner password"
              required
              disabled={isProcessing}
            />
          </div>

          <div className="warning-box">
            <svg className="w-5 h-5 mt-0.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="text-sm">
              <p className="font-bold text-foreground mb-1">Remember your password</p>
              <p className="text-muted-foreground">
                If you forget your password, we cannot help you recover it.
                There is no backdoor—your password only exists in your browser.
              </p>
            </div>
          </div>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Encrypting..." />}

          <button
            onClick={handleEncrypt}
            disabled={isProcessing || !ownerPassword || ownerPassword !== confirmPassword}
            className="btn-primary w-full"
          >
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Encrypting...
              </>
            ) : (
              <>
                <LockIcon className="w-5 h-5" />
                Encrypt PDF
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { LockIcon } from "@/components/icons/ui";
import { PdfIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PasswordInput } from "@/components/pdf/PasswordInput";
import { ErrorBox, PdfFileInfo, PdfPageHeader, ProgressBar, SuccessCard } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { useQpdf } from "@/lib/qpdf";
import { formatFileSize, getFileBaseName } from "@/lib/utils";

// Note: encrypt/page.tsx uses useQpdf which already provides isProcessing, progress, error, clearError
// so we keep the processingRef for double-click prevention only

interface EncryptResult {
  data: Uint8Array;
  filename: string;
}

export default function EncryptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<EncryptResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const { encrypt, isProcessing, progress, error: qpdfError, clearError } = useQpdf();

  const error = localError || qpdfError;

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        setFile(files[0]);
        setLocalError(null);
        setResult(null);
        clearError();
      }
    },
    [clearError],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setLocalError(null);
    setResult(null);
    setPassword("");
    clearError();
  }, [clearError]);

  const validateForm = (): string | null => {
    if (!password) {
      return "Password is required";
    }
    if (password.length < 4) {
      return "Password must be at least 4 characters";
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
      // Use the same password for both user and owner
      const data = await encrypt(file, {
        userPassword: password,
        ownerPassword: password,
        keyLength: 256,
        permissions: {
          print: true,
          modify: false,
          copy: false,
          annotate: false,
        },
      });

      const baseName = getFileBaseName(file.name);
      setResult({
        data,
        filename: `${baseName}_protected.pdf`,
      });
    } catch (err) {
      setLocalError(getErrorMessage(err, "Failed to encrypt PDF"));
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
    setPassword("");
    clearError();
  };

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<LockIcon className="w-7 h-7" />}
        iconClass="tool-encrypt"
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
          <div className="text-center text-sm text-muted-foreground">Your PDF is now password protected</div>
        </SuccessCard>
      ) : !file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />

          <InfoBox title="How it works">
            Set a password to protect your PDF. Anyone who wants to open the file will need this password.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          <PdfFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<PdfIcon className="w-5 h-5" />}
          />

          <div className="border-2 border-foreground/20 rounded-lg p-6">
            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Enter password"
              required
              disabled={isProcessing}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Forgot your password? We literally can&apos;t help—no servers, no backdoors, no recovery. That&apos;s the
            point.
          </p>

          {error && <ErrorBox message={error} />}
          {isProcessing && <ProgressBar progress={progress} label="Encrypting..." />}

          <button
            type="button"
            onClick={handleEncrypt}
            disabled={isProcessing || !password}
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

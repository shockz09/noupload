import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/encrypt")({
	head: () => ({
		meta: [
			{ title: "Encrypt PDF - Password Protect Your Documents | noupload" },
			{ name: "description", content: "Add password protection to your PDF files. Secure your documents with strong encryption. Works 100% in your browser." },
			{ name: "keywords", content: "encrypt pdf, password protect pdf, secure pdf, pdf encryption, lock pdf" },
			{ property: "og:title", content: "Encrypt PDF - Password Protect" },
			{ property: "og:description", content: "Add password protection to your PDFs. Works 100% offline." },
		],
	}),
	component: EncryptPage,
});

import { useCallback, useRef, useState } from "react";
import { LockIcon } from "@/components/icons/ui";
import { PdfIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PasswordInput } from "@/components/pdf/PasswordInput";
import { ErrorBox, PdfFileInfo, PdfPageHeader, PdfResultView } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { useFileBuffer } from "@/hooks";
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

function EncryptPage() {
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

  const { add: addToBuffer } = useFileBuffer();
  const handleHoldInBuffer = useCallback(() => {
    if (!result) return;
    const blob = new Blob([new Uint8Array(result.data)], { type: "application/pdf" });
    addToBuffer({
      filename: result.filename,
      blob,
      mimeType: "application/pdf",
      size: blob.size,
      fileType: "pdf",
      sourceToolLabel: "Encrypt PDF",
    });
  }, [result, addToBuffer]);

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<LockIcon className="w-7 h-7" />}
        iconClass="tool-encrypt"
        title="Encrypt PDF"
        description="Add password protection to your PDF documents"
      />

      {result ? (
        <PdfResultView
          title="PDF Encrypted!"
          subtitle="Your PDF is now password protected"
          data={result.data}
          size={result.data.length}
          downloadLabel="Download Protected PDF"
          onDownload={handleDownload}
          onHoldInBuffer={handleHoldInBuffer}
          onStartOver={handleStartOver}
          startOverLabel="Encrypt Another"
        />
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

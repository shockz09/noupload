"use client";

import { useCallback, useState } from "react";
import { Base64Icon, CheckIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import { ErrorBox, ImageFileInfo, ImagePageHeader } from "@/components/image/shared";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { InfoBox } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { useFileProcessing, useImagePaste, useObjectURL } from "@/hooks";
import { getErrorMessage } from "@/lib/error";
import { formatFileSize, imageToBase64 } from "@/lib/image-utils";
export default function ImageToBase64Page() {
  const { isLoaded } = useInstantMode();
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Use custom hooks
  const { url: preview, setSource: setPreview, revoke: revokePreview } = useObjectURL();
  const { isProcessing, error, startProcessing, stopProcessing, setError } = useFileProcessing();

  const handleFileSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        const selectedFile = files[0];
        setFile(selectedFile);
        setBase64(null);
        setCopied(false);
        setPreview(selectedFile);

        // Auto-convert
        if (!startProcessing()) return;
        try {
          const result = await imageToBase64(selectedFile);
          setBase64(result);
        } catch (err) {
          setError(getErrorMessage(err, "Failed to convert"));
        } finally {
          stopProcessing();
        }
      }
    },
    [setPreview, startProcessing, setError, stopProcessing],
  );

  // Use clipboard paste hook
  useImagePaste(handleFileSelected, !base64);

  const handleClear = useCallback(() => {
    revokePreview();
    setFile(null);
    setBase64(null);
    setCopied(false);
  }, [revokePreview]);

  const handleCopyDataUrl = useCallback(async () => {
    if (base64) {
      await navigator.clipboard.writeText(base64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [base64]);

  const handleCopyBase64Only = useCallback(async () => {
    if (base64) {
      const base64Only = base64.split(",")[1];
      await navigator.clipboard.writeText(base64Only);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [base64]);

  if (!isLoaded) return null;

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-8">
      <ImagePageHeader
        icon={<Base64Icon className="w-7 h-7" />}
        iconClass="tool-base64"
        title="Image to Base64"
        description="Convert images to Base64 string for embedding"
      />

      {!file ? (
        <div className="space-y-6">
          <FileDropzone
            accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your image here"
            subtitle="or click to browse · Ctrl+V to paste"
          />

          <InfoBox title="When to use Base64">
            Base64 is useful for embedding small images directly in HTML, CSS, or JavaScript. For large images,
            hosting them separately is more efficient.
          </InfoBox>
        </div>
      ) : (
        <div className="space-y-6">
          {preview && (
            <div className="border-2 border-foreground p-4 bg-muted/30">
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 mx-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <ImageFileInfo
            file={file}
            fileSize={formatFileSize(file.size)}
            onClear={handleClear}
            icon={<ImageIcon className="w-5 h-5" />}
          />

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground py-4">
              <LoaderIcon className="w-4 h-4" />
              <span>Converting...</span>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          {base64 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="input-label">Base64 Output</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(base64.length)} characters</span>
                </div>
                <textarea value={base64} readOnly className="input-field w-full h-32 font-mono text-xs resize-none" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={handleCopyDataUrl} className="btn-primary flex-1">
                  {copied ? (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        aria-hidden="true"
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Data URL
                    </>
                  )}
                </button>
                <button type="button" onClick={handleCopyBase64Only} className="btn-secondary flex-1">
                  Copy Base64 Only
                </button>
              </div>

              <div className="space-y-3 pt-4">
                <span className="input-label">Usage Examples</span>
                <div className="bg-muted/50 border-2 border-foreground p-3">
                  <p className="text-xs font-bold text-muted-foreground mb-1">HTML</p>
                  <code className="text-xs font-mono break-all">{`<img src="${base64.substring(0, 50)}..." />`}</code>
                </div>
                <div className="bg-muted/50 border-2 border-foreground p-3">
                  <p className="text-xs font-bold text-muted-foreground mb-1">CSS</p>
                  <code className="text-xs font-mono break-all">
                    {`background-image: url("${base64.substring(0, 40)}...");`}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

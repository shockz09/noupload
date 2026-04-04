"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BufferIcon, UploadIcon } from "@/components/icons/ui";
import { useFileBuffer } from "@/hooks/useFileBuffer";
import type { BufferItem } from "@/lib/file-buffer";
import { MIME_TO_EXTENSIONS } from "@/lib/file-buffer";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const FileDropzone = memo(function FileDropzone({
  accept = ".pdf",
  multiple = true,
  onFilesSelected,
  maxFiles = 50,
  maxSize = 100 * 1024 * 1024,
  className,
  title,
  subtitle,
  compact = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize accepted extensions parsing
  const acceptedExtensions = useMemo(() => accept.split(",").map((a) => a.trim().toLowerCase()), [accept]);

  // Buffer integration — show compatible buffered files & auto-consume pending items
  const { items: bufferItems, toFile, consumePendingItem } = useFileBuffer();
  const pendingConsumed = useRef(false);
  useEffect(() => {
    if (pendingConsumed.current) return;
    pendingConsumed.current = true;
    const file = consumePendingItem();
    if (file) onFilesSelected([file]);
  }, [consumePendingItem, onFilesSelected]);
  const compatibleBufferItems = useMemo(() => {
    return bufferItems.filter((item: BufferItem) => {
      const extensions = MIME_TO_EXTENSIONS[item.mimeType];
      if (!extensions) return false;
      return extensions.some((ext) => acceptedExtensions.includes(ext));
    });
  }, [bufferItems, acceptedExtensions]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      setError(null);
      const fileArray = Array.from(files);

      if (fileArray.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const oversized = fileArray.find((f) => f.size > maxSize);
      if (oversized) {
        setError(`File "${oversized.name}" exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
        return;
      }

      const validFiles = fileArray.filter((f) => {
        const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
        return acceptedExtensions.some((a) => a === ext || a === f.type);
      });

      if (validFiles.length !== fileArray.length) {
        setError(`Some files were skipped. Only ${accept} files are accepted.`);
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [accept, acceptedExtensions, maxFiles, maxSize, onFilesSelected],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      // Check if this is a buffer item drag
      const bufferId = e.dataTransfer.getData("application/x-buffer-id");
      if (bufferId) {
        const item = bufferItems.find((i: BufferItem) => i.id === bufferId);
        if (item) {
          onFilesSelected([toFile(item)]);
          return;
        }
      }

      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, bufferItems, toFile, onFilesSelected],
  );

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = "none";
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      handleFiles(target.files);
      input.remove();
    };
    // Safari requires the input to be in the DOM before .click() works
    document.body.appendChild(input);
    input.click();
  }, [accept, multiple, handleFiles]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  // Memoize display label
  const acceptLabel = useMemo(
    () =>
      accept
        .split(",")
        .map((a) => a.trim().toUpperCase().replace(".", ""))
        .join(", "),
    [accept],
  );

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "border-2 border-dashed border-muted-foreground/40 p-4 text-center cursor-pointer hover:border-foreground hover:bg-muted/30 transition-colors",
          isDragging && "border-foreground bg-muted/30",
          className,
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <UploadIcon className="w-5 h-5" />
          <span className="text-sm font-bold">{isDragging ? "Drop here" : title || "Add more files"}</span>
          {subtitle && <span className="text-xs">({subtitle})</span>}
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn("dropzone relative cursor-pointer", isDragging && "dragging dropzone-active", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="relative z-10 space-y-5">
        {/* Upload Icon */}
        <div className="upload-icon">
          <UploadIcon className="w-8 h-8" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <p className="text-xl font-bold text-foreground">
            {isDragging ? "Drop it like it's hot" : title || "Drop your files here"}
          </p>
          <p className="text-muted-foreground">{subtitle || "or click to browse from your device"}</p>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background font-bold text-sm border-2 border-foreground hover:bg-primary hover:border-primary transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Select Files
        </button>

        {/* File info */}
        <p className="text-xs text-muted-foreground font-medium pt-2">
          {acceptLabel} files • Max {Math.round(maxSize / 1024 / 1024)}MB
          {multiple && ` • Up to ${maxFiles} files`}
        </p>

        {/* Error */}
        {error && (
          <div className="error-box mt-4 justify-center">
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>

      {/* Buffer files */}
      {compatibleBufferItems.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 border-t-2 border-foreground bg-card px-4 py-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div className="flex items-center gap-2 mb-2">
            <BufferIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              From Buffer
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {compatibleBufferItems.map((item: BufferItem) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilesSelected([toFile(item)])}
                className="flex items-center gap-2 px-3 py-1.5 border-2 border-foreground/20 hover:border-foreground hover:bg-accent text-sm font-medium transition-colors"
                title={`Use ${item.filename} from ${item.sourceToolLabel}`}
              >
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" className="w-5 h-5 object-cover border border-foreground/20" />
                ) : (
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{item.fileType}</span>
                )}
                <span className="truncate max-w-[140px]">{item.filename}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

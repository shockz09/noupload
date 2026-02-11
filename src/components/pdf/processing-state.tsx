"use client";

import { memo } from "react";
import { formatFileSize } from "@/lib/utils";

interface ProcessingStateProps {
  status: "idle" | "processing" | "success" | "error";
  progress?: number;
  message?: string;
  fileName?: string;
  fileSize?: number;
  onDownload?: () => void;
  onStartOver?: () => void;
  error?: string;
}

export const ProcessingState = memo(function ProcessingState({
  status,
  progress = 0,
  message,
  fileName,
  fileSize,
  onDownload,
  onStartOver,
  error,
}: ProcessingStateProps) {
  if (status === "idle") return null;

  return (
    <div className="animate-fade-in">
      {status === "processing" && (
        <div className="p-8 rounded-2xl bg-card border border-border/50 text-center space-y-6">
          {/* Spinner */}
          <div className="relative w-20 h-20 mx-auto">
            <svg aria-hidden="true" className="w-20 h-20 animate-spin-slow" viewBox="0 0 100 100">
              <circle className="text-muted stroke-current" strokeWidth="8" fill="none" r="42" cx="50" cy="50" />
              <circle
                className="text-primary stroke-current"
                strokeWidth="8"
                fill="none"
                r="42"
                cx="50"
                cy="50"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.64} 264`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-semibold">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Message */}
          <div>
            <h3 className="text-lg font-semibold mb-1">Processing your files</h3>
            <p className="text-sm text-muted-foreground">{message || "Please wait while we process your files..."}</p>
          </div>

          {/* Progress bar */}
          <div className="max-w-xs mx-auto">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 text-center space-y-6 animate-scale-in">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-10 h-10 text-green-600"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          {/* Message */}
          <div>
            <h3 className="text-xl font-semibold text-green-900 mb-1">Your file is ready!</h3>
            <p className="text-sm text-green-700">{message || "Processing completed successfully"}</p>
          </div>

          {/* File info */}
          {(fileName || fileSize) && (
            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60 border border-green-200">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-5 h-5 text-green-600"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="text-left">
                {fileName && <p className="text-sm font-medium text-green-900 truncate max-w-[200px]">{fileName}</p>}
                {fileSize && <p className="text-xs text-green-700">{formatFileSize(fileSize)}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-green-600 text-white font-semibold shadow-lg shadow-green-600/25 hover:shadow-green-600/40 hover:bg-green-700 transition-all"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
            )}
            {onStartOver && (
              <button
                type="button"
                onClick={onStartOver}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-green-700 font-medium border border-green-200 hover:bg-green-50 transition-colors"
              >
                Process another file
              </button>
            )}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="p-8 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 text-center space-y-6 animate-scale-in">
          {/* Error Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-10 h-10 text-red-600"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>

          {/* Message */}
          <div>
            <h3 className="text-xl font-semibold text-red-900 mb-1">Something went wrong</h3>
            <p className="text-sm text-red-700">{error || "An error occurred while processing your files"}</p>
          </div>

          {/* Actions */}
          {onStartOver && (
            <button
              type="button"
              onClick={onStartOver}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
});

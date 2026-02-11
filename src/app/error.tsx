"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log error to console in development
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="w-16 h-16 mx-auto border-2 border-foreground bg-red-50 flex items-center justify-center">
          <svg
            aria-hidden="true"
            className="w-8 h-8 text-red-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-display">Something went wrong</h2>
          <p className="text-muted-foreground">
            An unexpected error occurred. Your files are safe and haven&apos;t been uploaded anywhere.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button type="button" onClick={reset} className="btn-primary w-full">
            Try Again
          </button>
          <a href="/" className="btn-secondary w-full inline-flex items-center justify-center">
            Go Home
          </a>
        </div>

        {process.env.NODE_ENV === "development" && error.message && (
          <details className="text-left border-2 border-foreground p-4 bg-muted/30">
            <summary className="cursor-pointer font-bold text-sm">Error Details</summary>
            <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap text-red-600">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

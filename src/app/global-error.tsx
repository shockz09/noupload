"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            backgroundColor: "#FAF7F2",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 1.5rem",
                border: "2px solid #1A1612",
                backgroundColor: "#FEE2E2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
                color: "#1A1612",
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                color: "#6B5E52",
                marginBottom: "1.5rem",
              }}
            >
              A critical error occurred. Please try refreshing the page.
            </p>

            <button
              type="button"
              onClick={reset}
              style={{
                width: "100%",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#1A1612",
                color: "#FAF7F2",
                border: "2px solid #1A1612",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "0.75rem",
              }}
            >
              Try Again
            </button>

            <Link
              href="/"
              style={{
                display: "block",
                width: "100%",
                padding: "0.75rem 1.5rem",
                backgroundColor: "transparent",
                color: "#1A1612",
                border: "2px solid #1A1612",
                fontWeight: "bold",
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

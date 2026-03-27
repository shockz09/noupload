"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CheckIcon } from "@/components/icons/ui";

export interface ImageEditorZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDownload: () => void;
  onCopy: () => void;
  isExporting: boolean;
  copySuccess: boolean;
}

export const ImageEditorZoomControls = memo(function ImageEditorZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onDownload,
  onCopy,
  isExporting,
  copySuccess,
}: ImageEditorZoomControlsProps) {
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = useCallback(() => {
    setShowDropdown((prev) => !prev);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  return (
    <div className="border-t-2 border-foreground bg-card px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoom <= 0.1}
            className="border-2 border-foreground w-8 h-8 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <div className="tabular-nums font-bold text-sm min-w-[4rem] text-center">
            {zoomPercent}%
          </div>

          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoom >= 3}
            className="border-2 border-foreground w-8 h-8 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onZoomReset}
            className="border-2 border-foreground w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors text-xs font-bold"
            title="Reset zoom"
          >
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        {/* Export dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={toggleDropdown}
            disabled={isExporting}
            className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={copySuccess ? { background: "#2D5A3D", color: "white" } : undefined}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : copySuccess ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
              </>
            )}
          </button>

          {showDropdown && !isExporting && !copySuccess && (
            <div className="absolute bottom-full right-0 mb-2 bg-card border-2 border-foreground shadow-[4px_4px_0_0_#1A1612] z-50 min-w-[180px]">
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-3 hover:bg-muted transition-colors"
                onClick={() => {
                  setShowDropdown(false);
                  onDownload();
                }}
              >
                <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PNG
              </button>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-3 hover:bg-muted transition-colors border-t border-foreground/10"
                onClick={() => {
                  setShowDropdown(false);
                  onCopy();
                }}
              >
                <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy to clipboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

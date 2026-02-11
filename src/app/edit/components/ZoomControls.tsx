"use client";

import { memo, useCallback, useMemo } from "react";

interface ZoomControlsProps {
  zoom: number;
  currentPage: number;
  totalPages: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
  isExporting?: boolean;
}

export const ZoomControls = memo(function ZoomControls({
  zoom,
  currentPage,
  totalPages,
  onZoomIn,
  onZoomOut,
  onPageChange,
  onExport,
  isExporting = false,
}: ZoomControlsProps) {
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  const handlePrevPage = useCallback(() => {
    onPageChange(currentPage - 1);
  }, [onPageChange, currentPage]);

  const handleNextPage = useCallback(() => {
    onPageChange(currentPage + 1);
  }, [onPageChange, currentPage]);

  return (
    <div className="border-t-2 border-foreground bg-card px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoom <= 0.25}
            className="w-8 h-8 flex items-center justify-center border-2 border-foreground/20 hover:border-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <div className="w-16 text-center text-sm font-mono font-bold">{zoomPercent}%</div>

          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoom >= 2}
            className="w-8 h-8 flex items-center justify-center border-2 border-foreground/20 hover:border-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="w-8 h-8 flex items-center justify-center border-2 border-foreground/20 hover:border-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="text-sm font-medium">
            <span className="font-mono font-bold">{currentPage}</span>
            <span className="text-muted-foreground mx-1">/</span>
            <span className="font-mono">{totalPages}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 flex items-center justify-center border-2 border-foreground/20 hover:border-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Export button */}
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export PDF"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
});

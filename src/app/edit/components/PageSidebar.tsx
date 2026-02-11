"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPdfjsWorkerSrc } from "@/lib/pdfjs-config";
import type { PageState } from "../page";

interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
}

interface PageSidebarProps {
  file: File;
  currentPage: number;
  pageStates: PageState[];
  onPageSelect: (page: number) => void;
  onPageStatesChange: (states: PageState[]) => void;
  onTotalPagesChange: (total: number) => void;
}

export function PageSidebar({
  file,
  currentPage,
  pageStates,
  onPageSelect,
  onPageStatesChange,
  onTotalPagesChange,
}: PageSidebarProps) {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag and drop state
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  // Load thumbnails
  useEffect(() => {
    let cancelled = false;

    async function loadThumbnails() {
      setLoading(true);

      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc(pdfjsLib.version);

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (cancelled) return;

        onTotalPagesChange(pdf.numPages);

        const thumbs: PageThumbnail[] = [];
        const scale = 0.2; // Small thumbnails

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const context = canvas.getContext("2d")!;
          await page.render({ canvasContext: context, viewport, canvas }).promise;

          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.7);
          });

          thumbs.push({
            pageNumber: i,
            dataUrl: URL.createObjectURL(blob),
          });

          // Cleanup canvas
          canvas.width = 0;
          canvas.height = 0;
        }

        if (!cancelled) {
          setThumbnails(thumbs);
        }
      } catch (err) {
        console.error("Failed to load thumbnails:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadThumbnails();

    return () => {
      cancelled = true;
      // Revoke blob URLs
      thumbnails.forEach((t) => {
        if (t.dataUrl.startsWith("blob:")) {
          URL.revokeObjectURL(t.dataUrl);
        }
      });
    };
  }, [file]);

  const handleRotate = (pageNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onPageStatesChange(
      pageStates.map((p) =>
        p.pageNumber === pageNumber ? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : p,
      ),
    );
  };

  const handleDelete = (pageNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const nonDeletedCount = pageStates.filter((p) => !p.deleted).length;
    if (nonDeletedCount <= 1) return; // Can't delete last page

    onPageStatesChange(pageStates.map((p) => (p.pageNumber === pageNumber ? { ...p, deleted: !p.deleted } : p)));
  };

  // Memoize page states as a Map for O(1) lookup instead of O(n) find
  const pageStatesMap = useMemo(() => {
    return new Map(pageStates.map((p) => [p.pageNumber, p]));
  }, [pageStates]);

  const getPageState = useCallback(
    (pageNumber: number) => {
      return pageStatesMap.get(pageNumber);
    },
    [pageStatesMap],
  );

  // Use refs to avoid stale closures in drag handlers
  const draggedPageRef = useRef<number | null>(null);

  // Drag and drop handlers (memoized)
  const handleDragStart = useCallback(
    (pageNumber: number, e: React.DragEvent) => {
      const pageState = pageStatesMap.get(pageNumber);
      if (pageState?.deleted) {
        e.preventDefault();
        return;
      }
      draggedPageRef.current = pageNumber;
      setDraggedPage(pageNumber);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(pageNumber));
      // Add some styling to the drag ghost
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = "0.5";
      }
    },
    [pageStatesMap],
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    draggedPageRef.current = null;
    setDraggedPage(null);
    setDragOverPage(null);
    dragCounterRef.current = 0;
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = "1";
    }
  }, []);

  const handleDragEnter = useCallback((pageNumber: number, e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (draggedPageRef.current !== null && draggedPageRef.current !== pageNumber) {
      setDragOverPage(pageNumber);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOverPage(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (targetPageNumber: number, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverPage(null);
      dragCounterRef.current = 0;

      const currentDraggedPage = draggedPageRef.current;
      if (currentDraggedPage === null || currentDraggedPage === targetPageNumber) return;

      // Reorder pageStates
      const newPageStates = [...pageStates];
      const draggedIndex = newPageStates.findIndex((p) => p.pageNumber === currentDraggedPage);
      const targetIndex = newPageStates.findIndex((p) => p.pageNumber === targetPageNumber);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Remove dragged item and insert at new position
      const [draggedItem] = newPageStates.splice(draggedIndex, 1);
      newPageStates.splice(targetIndex, 0, draggedItem);

      // Update page numbers to reflect new order
      const reorderedStates = newPageStates.map((state, index) => ({
        ...state,
        pageNumber: index + 1,
      }));

      // Also need to reorder thumbnails to match
      setThumbnails((currentThumbnails) => {
        const newThumbnails = [...currentThumbnails];
        const thumbDraggedIndex = newThumbnails.findIndex((t) => t.pageNumber === currentDraggedPage);
        const thumbTargetIndex = newThumbnails.findIndex((t) => t.pageNumber === targetPageNumber);

        if (thumbDraggedIndex !== -1 && thumbTargetIndex !== -1) {
          const [draggedThumb] = newThumbnails.splice(thumbDraggedIndex, 1);
          newThumbnails.splice(thumbTargetIndex, 0, draggedThumb);

          // Update thumbnail page numbers
          return newThumbnails.map((thumb, index) => ({
            ...thumb,
            pageNumber: index + 1,
          }));
        }
        return currentThumbnails;
      });

      onPageStatesChange(reorderedStates);
      draggedPageRef.current = null;
      setDraggedPage(null);
    },
    [pageStates, onPageStatesChange],
  );

  return (
    <div className="w-36 border-r-2 border-foreground bg-card overflow-y-auto">
      <div className="p-2 border-b border-foreground/20">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pages</span>
      </div>

      {loading ? (
        <div className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading...</p>
        </div>
      ) : (
        <div className="p-2 space-y-2">
          {thumbnails.map((thumb) => {
            const pageState = getPageState(thumb.pageNumber);
            const isDeleted = pageState?.deleted || false;
            const rotation = pageState?.rotation || 0;
            const isActive = thumb.pageNumber === currentPage;
            const isDragOver = dragOverPage === thumb.pageNumber;
            const isDragging = draggedPage === thumb.pageNumber;

            return (
              <div
                key={thumb.pageNumber}
                role="button"
                tabIndex={0}
                draggable={!isDeleted}
                onClick={() => !isDeleted && onPageSelect(thumb.pageNumber)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isDeleted) {
                    e.preventDefault();
                    onPageSelect(thumb.pageNumber);
                  }
                }}
                onDragStart={(e) => handleDragStart(thumb.pageNumber, e)}
                onDragEnd={handleDragEnd}
                onDragEnter={(e) => handleDragEnter(thumb.pageNumber, e)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(thumb.pageNumber, e)}
                className={`group relative cursor-pointer transition-all ${
                  isDeleted ? "opacity-40" : ""
                } ${isDragging ? "opacity-50 scale-95" : ""} ${isDragOver ? "transform translate-y-2" : ""}`}
              >
                {/* Drop indicator */}
                {isDragOver && <div className="absolute -top-1.5 left-0 right-0 h-1 bg-primary rounded-full z-20" />}

                {/* Thumbnail container */}
                <div
                  className={`relative border-2 overflow-hidden ${
                    isActive && !isDeleted ? "border-primary ring-2 ring-primary ring-offset-1" : "border-foreground/30"
                  } ${isDeleted ? "border-red-500/50" : ""} ${isDragOver ? "border-primary border-dashed" : ""}`}
                >
                  {/* Page image */}
                  <div className="aspect-[3/4] bg-white overflow-hidden">
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${thumb.pageNumber}`}
                      className="w-full h-full object-cover transition-transform"
                      style={{ transform: `rotate(${rotation}deg)` }}
                      draggable={false}
                    />
                  </div>

                  {/* Page number */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs py-0.5 text-center font-mono">
                    {thumb.pageNumber}
                  </div>

                  {/* Rotation indicator */}
                  {rotation !== 0 && !isDeleted && (
                    <div className="absolute top-1 left-1 w-4 h-4 bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                      {rotation}°
                    </div>
                  )}

                  {/* Deleted overlay */}
                  {isDeleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                      <svg
                        aria-hidden="true"
                        className="w-8 h-8 text-red-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  )}

                  {/* Drag handle indicator */}
                  {!isDeleted && (
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4 text-white drop-shadow-md"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="8" cy="6" r="2" />
                        <circle cx="16" cy="6" r="2" />
                        <circle cx="8" cy="12" r="2" />
                        <circle cx="16" cy="12" r="2" />
                        <circle cx="8" cy="18" r="2" />
                        <circle cx="16" cy="18" r="2" />
                      </svg>
                    </div>
                  )}

                  {/* Hover actions */}
                  {!isDeleted && (
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Rotate */}
                      <button
                        type="button"
                        onClick={(e) => handleRotate(thumb.pageNumber, e)}
                        className="w-5 h-5 bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                        title="Rotate 90°"
                      >
                        <svg
                          aria-hidden="true"
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(thumb.pageNumber, e)}
                        className="w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center"
                        title="Delete page"
                      >
                        <svg
                          aria-hidden="true"
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Restore button for deleted */}
                  {isDeleted && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(thumb.pageNumber, e)}
                      className="absolute top-1 right-1 w-5 h-5 bg-white border border-foreground text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Restore page"
                    >
                      <svg
                        aria-hidden="true"
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

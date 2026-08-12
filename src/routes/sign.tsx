import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign")({
	head: () => ({
		meta: [
			{ title: "Sign PDF Online Free - Add Signature to PDF | noupload" },
			{ name: "description", content: "Add your signature to PDF documents for free. Draw or upload your signature, place it anywhere on the page. Works 100% offline." },
			{ name: "keywords", content: "sign pdf, add signature to pdf, pdf signature, esign pdf, free pdf signer, online pdf signature" },
			{ property: "og:title", content: "Sign PDF Online Free - Add Signature to PDF" },
			{ property: "og:description", content: "Add your signature to PDF documents for free. Draw or upload your signature, works 100% offline." },
		],
	}),
	component: SignPage,
});

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderIcon } from "@/components/icons/ui";
import { SignatureIcon } from "@/components/icons/pdf";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PageGridLoading, usePdfPages } from "@/components/pdf/pdf-page-preview";
import { ErrorBox, PdfPageHeader, PdfResultView, ProgressBar } from "@/components/pdf/shared";
import { InfoBox } from "@/components/shared";
import { SignatureDrawPad, SignatureUpload } from "@/components/signature";
import { useFileBuffer } from "@/hooks";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { addSignature } from "@/lib/pdf-utils";
import { getFileBaseName } from "@/lib/utils";

interface SignResult {
  data: Uint8Array;
  filename: string;
  signedPages: number[];
}

// One placed signature. Position/size are percentages of the page box so they
// survive zoom, differing page sizes and rotation.
interface Placement {
  id: string;
  pageNumber: number;
  left: number; // % from left edge (0-100)
  top: number; // % from top edge (0-100)
  widthPct: number; // % of page width (5-50)
}

type SignatureMode = "draw" | "upload";
type DragMode = "move" | "resize" | null;

const DEFAULT_WIDTH_PCT = 25;
const MIN_WIDTH_PCT = 5;
// Full page width. Growth is still bounded by the page's right and bottom edges
// during resize, so this is a ceiling rather than the real limit.
const MAX_WIDTH_PCT = 100;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function SignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);

  // Signature
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [sigAspectRatio, setSigAspectRatio] = useState(3); // width/height, default ~3:1

  // Placed signatures — each one is independently movable/resizable/removable
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragRef = useRef<{ startX: number; startY: number; orig: Placement } | null>(null);
  const idCounter = useRef(0);
  const nextId = useCallback(() => `sig-${++idCounter.current}`, []);

  // Preview
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { pages, loading, progress } = usePdfPages(file, 0.8);

  // Signature height as a % of page height — depends on the page's own aspect ratio
  const getHeightPct = useCallback(
    (widthPct: number, pageWidth: number, pageHeight: number) =>
      (widthPct / sigAspectRatio) * (pageWidth / pageHeight),
    [sigAspectRatio],
  );

  // Load signature dimensions when it changes
  useEffect(() => {
    if (!signatureDataUrl) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setSigAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = signatureDataUrl;
  }, [signatureDataUrl]);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setPlacements([]);
    setSelectedId(null);
  }, []);

  const handleSignatureReady = useCallback((dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
  }, []);

  // Get mouse/touch position as % relative to a page element
  const getPctFromEvent = useCallback((pageEl: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = pageEl.getBoundingClientRect();
    return {
      xPct: ((clientX - rect.left) / rect.width) * 100,
      yPct: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Click on page background → drop a new signature centered at the click
  const handlePageClick = useCallback(
    (pageNumber: number, e: React.MouseEvent) => {
      if (!signatureDataUrl) return;
      // Don't place if we just finished dragging
      if (dragRef.current) return;

      const pageEl = pageRefs.current.get(pageNumber);
      if (!pageEl) return;

      const { xPct, yPct } = getPctFromEvent(pageEl, e.clientX, e.clientY);
      const w = DEFAULT_WIDTH_PCT;
      const heightPct = getHeightPct(w, pageEl.offsetWidth, pageEl.offsetHeight);

      const placement: Placement = {
        id: nextId(),
        pageNumber,
        left: clamp(xPct - w / 2, 0, 100 - w),
        top: clamp(yPct - heightPct / 2, 0, 100 - heightPct),
        widthPct: w,
      };

      setPlacements((prev) => [...prev, placement]);
      setSelectedId(placement.id);
    },
    [signatureDataUrl, getHeightPct, getPctFromEvent, nextId],
  );

  // Start moving or resizing one placement
  const handleDragStart = useCallback(
    (mode: "move" | "resize", placement: Placement, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      setSelectedId(placement.id);
      setDragMode(mode);
      dragRef.current = { startX: clientX, startY: clientY, orig: placement };
    },
    [],
  );

  const handleRemove = useCallback((id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const handleClearPlacements = useCallback(() => {
    setPlacements([]);
    setSelectedId(null);
  }, []);

  // Seed every other page with the selected signature's position and size. Each
  // copy stays independent afterwards, so single pages can still be nudged.
  const handleCopyToAllPages = useCallback(() => {
    const source = placements.find((p) => p.id === selectedId) ?? placements.at(-1);
    if (!source) return;

    setPlacements((prev) => [
      ...prev.filter((p) => p.pageNumber === source.pageNumber),
      ...pages
        .filter((page) => page.pageNumber !== source.pageNumber)
        .map((page) => ({ ...source, id: nextId(), pageNumber: page.pageNumber })),
    ]);
  }, [placements, selectedId, pages, nextId]);

  // Global move/up handlers for dragging
  useEffect(() => {
    if (!dragMode) return;

    const handleMove = (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pageEl = pageRefs.current.get(drag.orig.pageNumber);
      if (!pageEl) return;

      const rect = pageEl.getBoundingClientRect();
      const dxPct = ((clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((clientY - drag.startY) / rect.height) * 100;
      const orig = drag.orig;

      setPlacements((prev) =>
        prev.map((p) => {
          if (p.id !== orig.id) return p;

          if (dragMode === "move") {
            const heightPct = getHeightPct(orig.widthPct, rect.width, rect.height);
            return {
              ...orig,
              left: clamp(orig.left + dxPct, 0, 100 - orig.widthPct),
              top: clamp(orig.top + dyPct, 0, 100 - heightPct),
            };
          }

          // Cap the width so the box stays inside both the right and bottom edges
          const maxWidthByHeight = ((100 - orig.top) * sigAspectRatio * rect.height) / rect.width;
          const widthPct = Math.min(
            MAX_WIDTH_PCT,
            100 - orig.left,
            maxWidthByHeight,
            orig.widthPct + dxPct,
          );
          return { ...orig, widthPct: Math.max(MIN_WIDTH_PCT, widthPct) };
        }),
      );
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      setDragMode(null);
      // Small delay so the page click handler doesn't fire right after drag
      setTimeout(() => { dragRef.current = null; }, 50);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragMode, sigAspectRatio, getHeightPct]);

  // Delete/Backspace removes the selected signature, as in any canvas editor
  useEffect(() => {
    if (!selectedId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      e.preventDefault();
      handleRemove(selectedId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, handleRemove]);

  const handleSign = useCallback(async () => {
    if (!file || !signatureDataUrl || placements.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Placements are already percentages of the page box, which is exactly
      // what addSignature expects — no unit conversion, so the exported
      // signature matches the preview on every page size.
      const data = await addSignature(
        file,
        signatureDataUrl,
        placements.map(({ pageNumber, left, top, widthPct }) => ({
          pageNumber,
          leftPct: left,
          topPct: top,
          widthPct,
        })),
      );

      const signedPages = [...new Set(placements.map((p) => p.pageNumber))].sort((a, b) => a - b);
      const baseName = getFileBaseName(file.name);
      setResult({ data, filename: `${baseName}_signed.pdf`, signedPages });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to sign PDF"));
    } finally {
      setIsProcessing(false);
    }
  }, [file, signatureDataUrl, placements]);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (result) downloadBlob(result.data, result.filename);
    },
    [result],
  );

  const handleStartOver = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setSignatureDataUrl(null);
    setPlacements([]);
    setSelectedId(null);
  }, []);

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
      sourceToolLabel: "Sign PDF",
    });
  }, [result, addToBuffer]);

  const signedPageCount = new Set(placements.map((p) => p.pageNumber)).size;

  const setModeDraw = useCallback(() => setSignatureMode("draw"), []);
  const setModeUpload = useCallback(() => setSignatureMode("upload"), []);

  // Clear placements when the signature itself is removed
  const prevSigRef = useRef(signatureDataUrl);
  useEffect(() => {
    if (prevSigRef.current && !signatureDataUrl) handleClearPlacements();
    prevSigRef.current = signatureDataUrl;
  }, [signatureDataUrl, handleClearPlacements]);

  return (
    <div className="page-enter max-w-6xl mx-auto space-y-8">
      <PdfPageHeader
        icon={<SignatureIcon className="w-7 h-7" />}
        iconClass="tool-sign"
        title="Sign PDF"
        description="Draw or upload your signature, then place it on any page"
      />

      {result ? (
        <div className="max-w-2xl mx-auto">
          <PdfResultView
            title="PDF Signed!"
            subtitle={
              result.signedPages.length > 1
                ? `Your signature has been added to ${result.signedPages.length} pages`
                : `Your signature has been added to page ${result.signedPages[0]}`
            }
            data={result.data}
            size={result.data.length}
            downloadLabel="Download Signed PDF"
            onDownload={handleDownload}
            onHoldInBuffer={handleHoldInBuffer}
            onStartOver={handleStartOver}
            startOverLabel="Sign Another PDF"
          />
        </div>
      ) : !file ? (
        <div className="max-w-2xl mx-auto">
          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Scrollable page view */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {signatureDataUrl
                  ? placements.length > 0
                    ? `${placements.length} signature${placements.length > 1 ? "s" : ""} placed on ${signedPageCount} of ${pages.length} page${pages.length > 1 ? "s" : ""}`
                    : "Click on a page to place signature"
                  : "Add signature first →"}
              </h3>
              <button
                type="button"
                onClick={handleClear}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Change file
              </button>
            </div>

            {loading ? (
              <PageGridLoading progress={progress} />
            ) : (
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
                {pages.map((page) => {
                  const pagePlacements = placements.filter((p) => p.pageNumber === page.pageNumber);

                  return (
                    <div key={page.pageNumber} className="relative">
                      {/* Page number label */}
                      <div className="absolute top-3 left-3 z-10 file-number text-xs">
                        {page.pageNumber}
                      </div>

                      {/* Page */}
                      <div
                        ref={(el) => {
                          if (el) pageRefs.current.set(page.pageNumber, el);
                          else pageRefs.current.delete(page.pageNumber);
                        }}
                        role="application"
                        aria-label={`Page ${page.pageNumber} — click to place signature`}
                        className={`relative border-2 bg-white select-none overflow-hidden transition-all ${
                          signatureDataUrl ? "cursor-crosshair" : "cursor-not-allowed opacity-75"
                        } ${
                          pagePlacements.length > 0
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-foreground hover:border-primary/50"
                        }`}
                        onClick={(e) => handlePageClick(page.pageNumber, e)}
                      >
                        <img
                          src={page.dataUrl}
                          alt={`Page ${page.pageNumber}`}
                          className="w-full h-auto block pointer-events-none"
                          draggable={false}
                          loading="lazy"
                          decoding="async"
                        />

                        {/* Placed signatures — each one moves and resizes on its own */}
                        {signatureDataUrl &&
                          pagePlacements.map((placement) => {
                            const isSelected = placement.id === selectedId;

                            return (
                              <div
                                key={placement.id}
                                // Outline, not border: it must not take layout space,
                                // otherwise the signature renders a few px smaller
                                // than the box that defines the exported size
                                className={`absolute outline-2 outline-dashed bg-primary/5 ${
                                  isSelected ? "outline-primary z-10" : "outline-primary/40"
                                } ${dragMode === "move" && isSelected ? "cursor-grabbing" : "cursor-grab"}`}
                                style={{
                                  left: `${placement.left}%`,
                                  top: `${placement.top}%`,
                                  width: `${placement.widthPct}%`,
                                }}
                                onMouseDown={(e) => handleDragStart("move", placement, e)}
                                onTouchStart={(e) => handleDragStart("move", placement, e)}
                              >
                                <img
                                  src={signatureDataUrl}
                                  alt="Signature"
                                  className="w-full h-auto block pointer-events-none"
                                  draggable={false}
                                />

                                {/* Remove — top right corner */}
                                <button
                                  type="button"
                                  aria-label={`Remove signature on page ${page.pageNumber}`}
                                  className="absolute -top-2.5 -right-2.5 w-5 h-5 flex items-center justify-center bg-foreground text-white text-xs font-bold leading-none border-2 border-white hover:bg-destructive transition-colors z-20"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(placement.id);
                                  }}
                                >
                                  ×
                                </button>

                                {/* Resize handle — bottom right corner */}
                                <div
                                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary border-2 border-white cursor-nwse-resize z-20"
                                  onMouseDown={(e) => handleDragStart("resize", placement, e)}
                                  onTouchStart={(e) => handleDragStart("resize", placement, e)}
                                />
                              </div>
                            );
                          })}

                        {/* Overlay when no signature */}
                        {!signatureDataUrl && page.pageNumber === 1 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
                            <p className="text-muted-foreground font-medium px-4 py-2 bg-white/90 border-2 border-foreground">
                              Create your signature first →
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Signature creation (sticky) */}
          <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            {/* Mode Toggle */}
            <div className="flex border-2 border-foreground">
              <button
                type="button"
                onClick={setModeDraw}
                className={`flex-1 py-3 px-4 font-bold transition-colors ${
                  signatureMode === "draw" ? "bg-primary text-white" : "bg-card hover:bg-accent"
                }`}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={setModeUpload}
                className={`flex-1 py-3 px-4 font-bold border-l-2 border-foreground transition-colors ${
                  signatureMode === "upload" ? "bg-primary text-white" : "bg-card hover:bg-accent"
                }`}
              >
                Upload Image
              </button>
            </div>

            {/* Signature Area */}
            <div className="p-6 bg-card border-2 border-foreground">
              {signatureMode === "draw" ? (
                <SignatureDrawPad onSignatureReady={handleSignatureReady} height={160} />
              ) : (
                <SignatureUpload onSignatureReady={handleSignatureReady} />
              )}
            </div>

            {/* Placement actions */}
            {placements.length > 0 && (
              <div className="p-4 bg-card border-2 border-foreground space-y-3">
                <p className="text-sm font-bold">
                  {placements.length} signature{placements.length > 1 ? "s" : ""} placed
                </p>
                <div className="flex flex-wrap gap-2">
                  {pages.length > 1 && (
                    <button type="button" onClick={handleCopyToAllPages} className="btn-secondary text-sm py-2 px-3">
                      Copy to all {pages.length} pages
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearPlacements}
                    className="text-sm font-semibold text-muted-foreground hover:text-destructive transition-colors px-2"
                  >
                    Remove all
                  </button>
                </div>
              </div>
            )}

            {/* Info */}
            <InfoBox>
              {placements.length > 0
                ? "Drag each signature to reposition, pull its corner to resize, × to remove. Click a page to add another — every one is adjusted independently."
                : "Click on any page to place your signature. This is a visual signature, not a cryptographic one."}
            </InfoBox>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding signature..." />}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleSign}
              disabled={isProcessing || !signatureDataUrl || placements.length === 0}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  Processing...
                </>
              ) : (
                <>
                  <SignatureIcon className="w-5 h-5" />
                  {placements.length === 0
                    ? "Place Signature First"
                    : signedPageCount > 1
                      ? `Sign ${signedPageCount} Pages`
                      : `Sign Page ${placements[0].pageNumber}`}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

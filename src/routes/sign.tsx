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

// Box position/size stored as percentages of page dimensions
interface SignatureBox {
  pageNumber: number;
  left: number; // % from left edge (0-100)
  top: number; // % from top edge (0-100)
  widthPct: number; // % of page width (5-50)
}

type SignatureMode = "draw" | "upload";
type DragMode = "move" | "resize" | null;

const DEFAULT_WIDTH_PCT = 25;
const MIN_WIDTH_PCT = 5;
const MAX_WIDTH_PCT = 50;

function SignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);

  // Signature
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [sigAspectRatio, setSigAspectRatio] = useState(3); // width/height, default ~3:1

  // Draggable box
  const [box, setBox] = useState<SignatureBox | null>(null);
  const [applyToAllPages, setApplyToAllPages] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragRef = useRef<{ startX: number; startY: number; origBox: SignatureBox } | null>(null);

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
    setBox(null);
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

  // Click on page background → place box centered at click
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

      setBox({
        pageNumber,
        left: Math.max(0, Math.min(100 - w, xPct - w / 2)),
        top: Math.max(0, Math.min(100 - heightPct, yPct - heightPct / 2)),
        widthPct: w,
      });
    },
    [signatureDataUrl, getHeightPct, getPctFromEvent],
  );

  // Start dragging the box (move or resize). In all-pages mode the box is shown
  // on every page, so dragging any copy re-anchors it to that page.
  const handleBoxDragStart = useCallback(
    (mode: "move" | "resize", pageNumber: number, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!box) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const origBox = { ...box, pageNumber };
      setBox(origBox);
      setDragMode(mode);
      dragRef.current = { startX: clientX, startY: clientY, origBox };
    },
    [box],
  );

  // Global move/up handlers for dragging
  useEffect(() => {
    if (!dragMode || !dragRef.current) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (!dragRef.current || !box) return;
      const pageEl = pageRefs.current.get(box.pageNumber);
      if (!pageEl) return;

      const rect = pageEl.getBoundingClientRect();
      const dxPct = ((clientX - dragRef.current.startX) / rect.width) * 100;
      const dyPct = ((clientY - dragRef.current.startY) / rect.height) * 100;
      const orig = dragRef.current.origBox;

      if (dragMode === "move") {
        const heightPct = getHeightPct(orig.widthPct, rect.width, rect.height);
        setBox({
          ...orig,
          left: Math.max(0, Math.min(100 - orig.widthPct, orig.left + dxPct)),
          top: Math.max(0, Math.min(100 - heightPct, orig.top + dyPct)),
        });
      } else if (dragMode === "resize") {
        // Cap the width so the box stays inside both the right and bottom edges
        const maxWidthByHeight = ((100 - orig.top) * sigAspectRatio * rect.height) / rect.width;
        const newWidth = Math.min(
          MAX_WIDTH_PCT,
          100 - orig.left,
          maxWidthByHeight,
          orig.widthPct + dxPct,
        );
        setBox({ ...orig, widthPct: Math.max(MIN_WIDTH_PCT, newWidth) });
      }
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
  }, [dragMode, box, sigAspectRatio, getHeightPct]);

  const handleSign = useCallback(async () => {
    if (!file || !signatureDataUrl || !box) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // The box is already stored as percentages of the page box, which is
      // exactly what addSignature expects — no unit conversion, so the exported
      // signature matches the preview on every page size.
      const pageNumbers = applyToAllPages
        ? pages.map((p) => p.pageNumber)
        : [box.pageNumber];

      const data = await addSignature(file, signatureDataUrl, {
        leftPct: box.left,
        topPct: box.top,
        widthPct: box.widthPct,
        pageNumbers,
      });

      const baseName = getFileBaseName(file.name);
      setResult({ data, filename: `${baseName}_signed.pdf`, signedPages: pageNumbers });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to sign PDF"));
    } finally {
      setIsProcessing(false);
    }
  }, [file, signatureDataUrl, box, applyToAllPages, pages]);

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
    setBox(null);
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

  const setModeDraw = useCallback(() => setSignatureMode("draw"), []);
  const setModeUpload = useCallback(() => setSignatureMode("upload"), []);

  // Clear box when signature is removed
  const prevSigRef = useRef(signatureDataUrl);
  useEffect(() => {
    if (prevSigRef.current && !signatureDataUrl) setBox(null);
    prevSigRef.current = signatureDataUrl;
  }, [signatureDataUrl]);

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
                ? `Your signature has been added to all ${result.signedPages.length} pages`
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
                  ? box
                    ? applyToAllPages
                      ? `Signature on all ${pages.length} pages`
                      : `Signature on page ${box.pageNumber}`
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
                  const isBoxPage = box?.pageNumber === page.pageNumber;
                  const showBox = !!box && (isBoxPage || applyToAllPages);

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
                          showBox
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

                        {/* Draggable signature box */}
                        {signatureDataUrl && showBox && box && (
                          <div
                            // Outline, not border: it must not take layout space,
                            // otherwise the signature renders a few px smaller
                            // than the box that defines the exported size
                            className={`absolute outline-2 outline-dashed outline-primary/80 bg-primary/5 ${
                              dragMode === "move" ? "cursor-grabbing" : "cursor-grab"
                            }`}
                            style={{
                              left: `${box.left}%`,
                              top: `${box.top}%`,
                              width: `${box.widthPct}%`,
                            }}
                            onMouseDown={(e) => handleBoxDragStart("move", page.pageNumber, e)}
                            onTouchStart={(e) => handleBoxDragStart("move", page.pageNumber, e)}
                          >
                            <img
                              src={signatureDataUrl}
                              alt="Signature"
                              className="w-full h-auto block pointer-events-none"
                              draggable={false}
                            />

                            {/* Resize handle — bottom right corner */}
                            <div
                              className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary border-2 border-white cursor-nwse-resize z-10"
                              onMouseDown={(e) => handleBoxDragStart("resize", page.pageNumber, e)}
                              onTouchStart={(e) => handleBoxDragStart("resize", page.pageNumber, e)}
                            />
                          </div>
                        )}

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

            {/* Apply to every page at the same spot */}
            {pages.length > 1 && (
              <label className="flex items-start gap-3 p-4 bg-card border-2 border-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllPages}
                  onChange={(e) => setApplyToAllPages(e.target.checked)}
                  className="w-4 h-4 mt-0.5 border-2 border-foreground shrink-0"
                />
                <span>
                  <span className="block font-bold text-sm">
                    Sign all {pages.length} pages
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Places the signature at the same position and size on every page
                  </span>
                </span>
              </label>
            )}

            {/* Info */}
            <InfoBox>
              {box
                ? applyToAllPages
                  ? "Drag or resize the signature on any page — every page updates together."
                  : "Drag to reposition, pull corner to resize. Click another page to move it."
                : "Click on any page to place your signature. This is a visual signature, not a cryptographic one."}
            </InfoBox>

            {error && <ErrorBox message={error} />}
            {isProcessing && <ProgressBar progress={50} label="Adding signature..." />}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleSign}
              disabled={isProcessing || !signatureDataUrl || !box}
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
                  {box
                    ? applyToAllPages
                      ? `Sign All ${pages.length} Pages`
                      : `Sign Page ${box.pageNumber}`
                    : "Place Signature First"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

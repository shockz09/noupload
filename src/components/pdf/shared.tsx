import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DownloadIcon } from "@/components/icons/ui";
import { FileInfo, PageHeader } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { formatFileSize } from "@/lib/utils";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Re-export common components
export {
  ErrorBox,
  ProcessButton,
  ProgressBar,
  SuccessCard,
} from "@/components/shared";

// ============ PDF Page Header (wrapper) ============
interface PdfPageHeaderProps {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export const PdfPageHeader = memo(function PdfPageHeader({ icon, iconClass, title, description }: PdfPageHeaderProps) {
  return (
    <PageHeader
      icon={icon}
      iconClass={iconClass}
      title={title}
      description={description}
      backHref="/"
      backLabel="Back to tools"
    />
  );
});

// ============ PDF File Info (alias) ============
export const PdfFileInfo = FileInfo;

// ============ PDF Preview (single-page viewer with navigation) ============

async function renderPdfPage(pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9);
  });
  canvas.width = 0;
  canvas.height = 0;

  return URL.createObjectURL(blob);
}

export const PdfPreview = memo(function PdfPreview({ data }: { data: Uint8Array | Blob }) {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);

  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const urlRef = useRef<string | null>(null);

  // Load the PDF document once
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const pdfjsLib = await (await import("@/lib/pdfjs-config")).loadPdfjs();
      const arrayBuffer = data instanceof Blob
        ? await data.arrayBuffer()
        : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

      if (cancelled) return;
      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    }

    load();
    return () => { cancelled = true; };
  }, [data]);

  // Render current page — keep old image visible while new one renders
  useEffect(() => {
    if (!pdfRef.current || totalPages === 0) return;
    let cancelled = false;

    renderPdfPage(pdfRef.current, currentPage).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPageUrl(url);
      setInitialLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentPage, totalPages]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const prevPage = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const nextPage = useCallback(() => setCurrentPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  return (
    <div className="border-2 border-foreground bg-muted/20 relative group">
      {/* Page display — always show current image, no spinner on page change */}
      <div className="flex items-center justify-center bg-muted/30" style={{ minHeight: 200 }}>
        {pageUrl ? (
          <img
            src={pageUrl}
            alt={`Page ${currentPage}`}
            className="w-full max-h-96 object-contain"
            draggable={false}
          />
        ) : initialLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : null}
      </div>

      {/* Bottom control bar */}
      <div className="h-8 border-t-2 border-foreground bg-background flex items-center justify-between px-3">
        {/* Page indicator */}
        <div className="flex items-center gap-2">
          <svg aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {totalPages === 1 ? "1 PAGE" : `${totalPages} PAGES`}
          </span>
        </div>

        {/* Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="w-5 h-5 flex items-center justify-center text-foreground disabled:text-muted-foreground/40 hover:bg-muted transition-colors"
            >
              <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="font-mono text-xs font-bold tabular-nums">
              <span className="text-foreground">{currentPage}</span>
              <span className="text-muted-foreground mx-0.5">/</span>
              <span className="text-muted-foreground">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={nextPage}
              disabled={currentPage >= totalPages}
              className="w-5 h-5 flex items-center justify-center text-foreground disabled:text-muted-foreground/40 hover:bg-muted transition-colors"
            >
              <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ============ PDF Result View ============
// Preview hero on top, compact action bar below — same pattern as VideoResultView / ImageResultView

interface PdfResultViewProps {
  title: string;
  subtitle?: string;
  /** Raw PDF data for first-page preview */
  data?: Uint8Array | Blob;
  size?: number;
  downloadLabel: string;
  onDownload: (e: React.MouseEvent) => void;
  onHoldInBuffer?: () => void;
  onStartOver: () => void;
  startOverLabel: string;
  children?: ReactNode;
}

export const PdfResultView = memo(function PdfResultView({
  title,
  subtitle,
  data,
  size,
  downloadLabel,
  onDownload,
  onHoldInBuffer,
  onStartOver,
  startOverLabel,
  children,
}: PdfResultViewProps) {
  const { isInstant } = useInstantMode();
  const bufferedRef = useRef(false);
  useEffect(() => {
    if (isInstant && onHoldInBuffer && !bufferedRef.current) {
      bufferedRef.current = true;
      onHoldInBuffer();
    }
  }, [isInstant, onHoldInBuffer]);

  return (
    <div className="animate-fade-up space-y-0">
      {/* PDF first-page preview */}
      {data && <PdfPreview data={data} />}

      {/* Action bar */}
      <div className={`border-2 ${data ? "border-t-0" : ""} border-foreground bg-background p-4 space-y-3`}>
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {size != null && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {formatFileSize(size)}
            </span>
          )}
        </div>

        {children}

        {/* Buttons */}
        <div className="flex gap-2">
          <button type="button" onClick={onDownload} className="btn-success flex-1">
            <DownloadIcon className="w-4 h-4 shrink-0" />
            {downloadLabel}
          </button>
          <button type="button" onClick={onStartOver} className="btn-secondary">
            {startOverLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

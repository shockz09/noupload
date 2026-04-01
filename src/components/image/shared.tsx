import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { DownloadIcon, CopyIcon } from "@/components/icons/ui";
import { FileInfo, PageHeader } from "@/components/shared";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import { formatFileSize } from "@/lib/utils";

// Re-export common components
export {
  ErrorBox,
  ProcessButton,
  ProgressBar,
  SuccessCard,
} from "@/components/shared";

// ============ Image Page Header (wrapper) ============
interface ImagePageHeaderProps {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
}

export const ImagePageHeader = memo(function ImagePageHeader({
  icon,
  iconClass,
  title,
  description,
}: ImagePageHeaderProps) {
  return (
    <PageHeader
      icon={icon}
      iconClass={iconClass}
      title={title}
      description={description}
      backHref="/"
      backLabel="Back to Image Tools"
      tabKey="image"
    />
  );
});

// ============ Image File Info (alias) ============
export const ImageFileInfo = FileInfo;

// ============ Image Result View ============
// Image hero on top, compact action bar below — same pattern as VideoResultView

interface ImageResultProps {
  blob: Blob;
  title: string;
  subtitle?: string;
  downloadLabel: string;
  onDownload: (e: React.MouseEvent) => void;
  onCopy?: () => void;
  onHoldInBuffer?: () => void;
  onStartOver: () => void;
  startOverLabel: string;
  children?: ReactNode;
  /** Show checkerboard behind image (for transparent PNGs) */
  transparent?: boolean;
}

export const ImageResultView = memo(function ImageResultView({
  blob,
  title,
  subtitle,
  downloadLabel,
  onDownload,
  onCopy,
  onHoldInBuffer,
  onStartOver,
  startOverLabel,
  children,
  transparent,
}: ImageResultProps) {
  const [url, setUrl] = useState<string | null>(null);
  const { isInstant } = useInstantMode();
  const bufferedRef = useRef(false);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  useEffect(() => {
    if (isInstant && onHoldInBuffer && !bufferedRef.current) {
      bufferedRef.current = true;
      onHoldInBuffer();
    }
  }, [isInstant, onHoldInBuffer]);

  return (
    <div className="animate-fade-up space-y-0">
      {/* Image preview */}
      <div
        className="border-2 border-foreground bg-muted/30 flex items-center justify-center p-2"
        style={transparent ? {
          backgroundImage: `
            linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
            linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
            linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
          `,
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        } : undefined}
      >
        {url && (
          <img
            src={url}
            alt="Result preview"
            className="max-w-full max-h-80 object-contain"
            draggable={false}
          />
        )}
      </div>

      {/* Action bar */}
      <div className="border-2 border-t-0 border-foreground bg-background p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {children}
            <span className="text-xs font-mono text-muted-foreground">
              {formatFileSize(blob.size)}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button type="button" onClick={onDownload} className="btn-success flex-1">
            <DownloadIcon className="w-4 h-4 shrink-0" />
            {downloadLabel}
          </button>
          {onCopy && (
            <button type="button" onClick={onCopy} className="btn-success px-3 shrink-0" title="Copy to clipboard">
              <CopyIcon className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onStartOver} className="btn-secondary">
            {startOverLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

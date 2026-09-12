import { memo, useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon } from "@/components/icons/ui";

/**
 * Download, with the format tucked behind a caret.
 *
 * A split button rather than a plain menu: almost everyone wants .srt, so the
 * common case stays one click, and the two people who need WebVTT get a list
 * that says what each format is actually for — ".vtt" tells a non-technical
 * user nothing.
 *
 * The caret only *chooses*; nothing is downloaded until the button itself is
 * pressed. Downloading straight from the list would make the remembered format
 * pointless — you would already have the file — and it would fire a download
 * from a control whose entries read as formats rather than actions.
 */

export interface CaptionFormat {
  ext: string;
  label: string;
  note: string;
}

export const CAPTION_FORMATS: CaptionFormat[] = [
  { ext: "srt", label: ".srt", note: "SubRip — players, YouTube, Premiere" },
  { ext: "vtt", label: ".vtt", note: "WebVTT — the web’s own format" },
  { ext: "txt", label: ".txt", note: "Plain transcript, no timings" },
];

interface DownloadMenuProps {
  onDownload: (ext: string) => void;
}

export const DownloadMenu = memo(function DownloadMenu({ onDownload }: DownloadMenuProps) {
  const [format, setFormat] = useState(CAPTION_FORMATS[0]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) caretRef.current?.focus();
  }, []);

  // Dismiss the way every menu on the web does: click elsewhere, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Opening with the keyboard should land on the list, not leave focus behind.
  useEffect(() => {
    if (open) itemsRef.current[0]?.focus();
  }, [open]);

  const pick = useCallback(
    (chosen: CaptionFormat) => {
      setFormat(chosen);
      close(true);
    },
    [close],
  );

  const moveFocus = useCallback((from: number, delta: number) => {
    const next = (from + delta + CAPTION_FORMATS.length) % CAPTION_FORMATS.length;
    itemsRef.current[next]?.focus();
  }, []);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <div className="inline-flex items-stretch border-2 border-foreground">
        <button
          type="button"
          onClick={() => onDownload(format.ext)}
          className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-foreground"
        >
          <DownloadIcon className="h-4 w-4" />
          Download {format.label}
        </button>
        <button
          ref={caretRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Choose a subtitle format"
          onClick={() => setOpen((previous) => !previous)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className="grid place-items-center border-l-2 border-foreground bg-primary px-2 text-white transition-colors hover:bg-foreground"
        >
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* A menu of buttons rather than a <select>: each format needs a line
          saying what it is for, which an <option> cannot carry. */}
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] border-2 border-foreground bg-background shadow-[4px_4px_0_0_var(--color-foreground)]"
        >
          {CAPTION_FORMATS.map((option, index) => (
            <button
              key={option.ext}
              ref={(node) => {
                itemsRef.current[index] = node;
              }}
              type="button"
              role="menuitem"
              onClick={() => pick(option)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(index, -1);
                } else if (event.key === "Tab") {
                  close();
                }
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted focus:bg-muted focus:outline-none ${
                option.ext === format.ext ? "bg-muted/60" : ""
              }`}
            >
              <span className="w-3 shrink-0 text-sm font-bold">{option.ext === format.ext ? "✓" : ""}</span>
              <span className="text-sm font-bold">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.note}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

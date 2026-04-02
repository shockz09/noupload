"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useFileBuffer } from "@/hooks/useFileBuffer";
import { useInstantMode } from "@/components/shared/InstantModeToggle";
import type { BufferItem } from "@/lib/file-buffer";
import { formatFileSize } from "@/lib/utils";

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  image: "IMG",
  audio: "AUD",
  other: "FILE",
};

const TOOL_ROUTES: Record<string, { label: string; href: string }[]> = {
  pdf: [
    { label: "Compress", href: "/compress" },
    { label: "Merge", href: "/merge" },
    { label: "Split", href: "/split" },
    { label: "Rotate", href: "/rotate" },
    { label: "Watermark", href: "/watermark" },
    { label: "Encrypt", href: "/encrypt" },
    { label: "Grayscale", href: "/grayscale" },
    { label: "Metadata", href: "/metadata" },
  ],
  image: [
    { label: "Compress", href: "/image/compress" },
    { label: "Resize", href: "/image/resize" },
    { label: "Convert", href: "/image/convert" },
    { label: "Crop", href: "/image/crop" },
    { label: "Rotate", href: "/image/rotate" },
    { label: "Filters", href: "/image/filters" },
    { label: "Watermark", href: "/image/watermark" },
  ],
  audio: [
    { label: "Trim", href: "/audio/trim" },
    { label: "Merge", href: "/audio/merge" },
    { label: "Speed", href: "/audio/speed" },
    { label: "Volume", href: "/audio/volume" },
    { label: "Reverse", href: "/audio/reverse" },
    { label: "Normalize", href: "/audio/normalize" },
  ],
};

function DockItem({
  item,
  onRemove,
  onNavigate,
}: {
  item: BufferItem;
  onRemove: (id: string) => void;
  onNavigate: (itemId: string, href: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tools = TOOL_ROUTES[item.fileType] || [];

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  return (
    <div className="dock-item-wrapper" ref={menuRef}>
      {showMenu && (
        <div className="dock-menu">
          <div className="dock-menu-header">
            <p className="text-xs font-bold truncate">{item.filename}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatFileSize(item.size)} · {item.sourceToolLabel}
            </p>
          </div>
          {tools.length > 0 && (
            <div className="dock-menu-section">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1">
                Open in
              </p>
              {tools.map((tool) => (
                <button
                  key={tool.href}
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate(item.id, tool.href);
                  }}
                  className="dock-menu-item"
                >
                  {tool.label}
                </button>
              ))}
            </div>
          )}
          <div className="dock-menu-section">
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(item.blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = item.filename;
                a.click();
                URL.revokeObjectURL(url);
                setShowMenu(false);
              }}
              className="dock-menu-item"
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => {
                onRemove(item.id);
                setShowMenu(false);
              }}
              className="dock-menu-item text-destructive"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-buffer-id", item.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => setShowMenu((prev) => !prev)}
        className={`dock-thumb ${showMenu ? "active" : ""}`}
        title={`${item.filename} — ${formatFileSize(item.size)}`}
      >
        {item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="dock-thumb-label">
            {FILE_TYPE_LABELS[item.fileType] || "FILE"}
          </span>
        )}
      </button>
    </div>
  );
}

export const BufferDock = memo(function BufferDock() {
  const { items, remove, setPendingItem } = useFileBuffer();
  const { isInstant } = useInstantMode();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  const shouldShow = isInstant && items.length > 0;

  useEffect(() => {
    if (shouldShow) {
      setIsVisible(true);
    } else if (isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [shouldShow, isVisible]);

  const reversedItems = useMemo(() => [...items].reverse(), [items]);

  const handleNavigate = useCallback((itemId: string, href: string) => {
    setPendingItem(itemId);
    router.push(href);
  }, [router, setPendingItem]);

  if (!isVisible) return null;

  return (
    <div className={`buffer-dock ${shouldShow ? "open" : "closed"}`}>
      <div className={`dock-inner ${items.length === 1 ? "single" : ""}`}>
        <div className="dock-items">
          {reversedItems.map((item) => (
            <DockItem key={item.id} item={item} onRemove={remove} onNavigate={handleNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
});

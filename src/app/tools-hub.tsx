"use client";

import { memo, useCallback, useState } from "react";
import { ToolSearch } from "@/components/shared/ToolSearch";
import { audioCategoryLabels, audioTools } from "./audio-tools-grid";
import { imageCategoryLabels, imageTools } from "./image-tools-grid";
import { pdfCategoryLabels, pdfTools } from "./pdf-tools-grid";
import { qrCategoryLabels, qrTools } from "./qr-tools-grid";

// ── Category definitions ─────────────────────────────────────

type CategoryKey = "pdf" | "image" | "audio" | "qr";

interface CategoryDef {
  key: CategoryKey;
  label: string;
  count: number;
  accentColor: string;
  tools: typeof pdfTools;
  categoryLabels: Record<string, string>;
  placeholder: string;
}

const categories: CategoryDef[] = [
  {
    key: "pdf",
    label: "PDF",
    count: pdfTools.length,
    accentColor: "#C84C1C",
    tools: pdfTools,
    categoryLabels: pdfCategoryLabels,
    placeholder: "Search PDF tools...",
  },
  {
    key: "image",
    label: "Image",
    count: imageTools.length,
    accentColor: "#16A34A",
    tools: imageTools,
    categoryLabels: imageCategoryLabels,
    placeholder: "Search image tools...",
  },
  {
    key: "audio",
    label: "Audio",
    count: audioTools.length,
    accentColor: "#8B5CF6",
    tools: audioTools,
    categoryLabels: audioCategoryLabels,
    placeholder: "Search audio tools...",
  },
  {
    key: "qr",
    label: "QR Code",
    count: qrTools.length,
    accentColor: "#F59E0B",
    tools: qrTools,
    categoryLabels: qrCategoryLabels,
    placeholder: "Search QR tools...",
  },
];

// ── Component ────────────────────────────────────────────────

export const ToolsHub = memo(function ToolsHub() {
  const [active, setActive] = useState<CategoryKey>("pdf");

  const handleSelect = useCallback((key: CategoryKey) => {
    setActive(key);
  }, []);

  const current = categories.find((c) => c.key === active)!;

  return (
    <div className="space-y-8">
      {/* Category pills */}
      <div className="flex flex-wrap gap-3">
        {categories.map((cat) => {
          const isActive = cat.key === active;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleSelect(cat.key)}
              data-active={isActive}
              className="category-pill px-4 py-2 text-sm font-bold cursor-pointer"
              style={{ "--cat-color": cat.accentColor } as React.CSSProperties}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs font-semibold ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active category tools */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display">{current.label} Tools</h2>
          <div className="flex-1 h-0.5 bg-foreground" />
        </div>

        <ToolSearch tools={current.tools} categoryLabels={current.categoryLabels} placeholder={current.placeholder} />
      </section>
    </div>
  );
});

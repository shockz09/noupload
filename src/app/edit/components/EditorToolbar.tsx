"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { Tool } from "../page";

const CUSTOM_STAMPS_KEY = "pdf-editor-custom-stamps";

export interface StampData {
  text: string;
  color: string;
  shape: "rect" | "circle";
  subText?: string; // For circular stamps - bottom text
}

interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSignatureClick: () => void;
  onStampSelect: (stamp: StampData) => void;
  onImageSelect: (dataUrl: string) => void;
  isUnderlineActive?: boolean;
  isStrikethroughActive?: boolean;
  onToggleUnderline?: () => void;
  onToggleStrikethrough?: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#FFEB3B" },
  { name: "Green", value: "#81C784" },
  { name: "Blue", value: "#64B5F6" },
  { name: "Pink", value: "#F48FB1" },
  { name: "Orange", value: "#FFB74D" },
];

const SHAPE_TOOLS: { tool: Tool; label: string; icon: string }[] = [
  { tool: "shape-rect", label: "Rectangle", icon: "□" },
  { tool: "shape-circle", label: "Circle", icon: "○" },
  { tool: "shape-arrow", label: "Arrow", icon: "→" },
  { tool: "shape-line", label: "Line", icon: "—" },
];

const STAMPS = ["APPROVED", "REJECTED", "DRAFT", "CONFIDENTIAL", "VOID", "COPY", "FINAL"];

const STAMP_COLORS = [
  { name: "Red", value: "#FF0000" },
  { name: "Green", value: "#22C55E" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Orange", value: "#F97316" },
  { name: "Purple", value: "#A855F7" },
  { name: "Black", value: "#000000" },
];

export function EditorToolbar({
  activeTool,
  onToolChange,
  highlightColor,
  onHighlightColorChange,
  strokeColor,
  onStrokeColorChange,
  onClear,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSignatureClick,
  onStampSelect,
  onImageSelect,
  isUnderlineActive,
  isStrikethroughActive,
  onToggleUnderline,
  onToggleStrikethrough,
}: EditorToolbarProps) {
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showStampDropdown, setShowStampDropdown] = useState(false);
  const [stampColor, setStampColor] = useState("#FF0000");
  const [stampShape, setStampShape] = useState<"rect" | "circle">("circle");
  const [customStampText, setCustomStampText] = useState("");
  const [customStamps, setCustomStamps] = useState<string[]>([]);

  const isShapeTool = activeTool.startsWith("shape-");

  // Memoized dropdown toggle handlers
  const toggleHighlightDropdown = useCallback(() => {
    setShowHighlightDropdown((prev) => !prev);
  }, []);

  const toggleShapeDropdown = useCallback(() => {
    setShowShapeDropdown((prev) => !prev);
  }, []);

  const toggleStampDropdown = useCallback(() => {
    setShowStampDropdown((prev) => !prev);
  }, []);

  // Load custom stamps from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_STAMPS_KEY);
      if (saved) {
        setCustomStamps(JSON.parse(saved));
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Close all dropdowns
  const closeAllDropdowns = useCallback(() => {
    setShowHighlightDropdown(false);
    setShowShapeDropdown(false);
    setShowStampDropdown(false);
  }, []);

  // Escape key closes dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAllDropdowns();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeAllDropdowns]);

  // Click outside closes dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dropdown]")) {
        closeAllDropdowns();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeAllDropdowns]);

  // Save custom stamp
  const saveCustomStamp = useCallback((text: string) => {
    const upperText = text.toUpperCase().trim();
    if (!upperText || STAMPS.includes(upperText)) return;

    setCustomStamps((prev) => {
      // Don't add duplicates, move to front if exists
      const filtered = prev.filter((s) => s !== upperText);
      const updated = [upperText, ...filtered].slice(0, 10); // Keep max 10
      try {
        localStorage.setItem(CUSTOM_STAMPS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore errors
      }
      return updated;
    });
  }, []);

  // Remove custom stamp
  const removeCustomStamp = useCallback((text: string) => {
    setCustomStamps((prev) => {
      const updated = prev.filter((s) => s !== text);
      try {
        localStorage.setItem(CUSTOM_STAMPS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore errors
      }
      return updated;
    });
  }, []);

  return (
    <div className="border-b-2 border-foreground bg-card px-4 py-2">
      <div className="flex items-center gap-1 flex-wrap">
        {/* Select Tool */}
        <ToolButton active={activeTool === "select"} onClick={() => onToolChange("select")} title="Select (V)">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
        </ToolButton>

        <div className="w-px h-6 bg-foreground/20 mx-1" />

        {/* Text Tool */}
        <ToolButton active={activeTool === "text"} onClick={() => onToolChange("text")} title="Text (T)">
          <span className="font-bold text-sm">T</span>
        </ToolButton>

        {/* Signature Tool */}
        <ToolButton active={activeTool === "signature"} onClick={onSignatureClick} title="Signature">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
            <line x1="17.5" y1="15" x2="9" y2="15" />
          </svg>
        </ToolButton>

        <div className="w-px h-6 bg-foreground/20 mx-1" />

        {/* Highlight Tool with dropdown */}
        <div className="relative" data-dropdown>
          <ToolButton
            active={activeTool === "highlight"}
            onClick={() => onToolChange("highlight")}
            title="Highlight"
            hasDropdown
            onDropdownClick={toggleHighlightDropdown}
          >
            <div className="w-4 h-4 border border-foreground/30" style={{ backgroundColor: highlightColor }} />
          </ToolButton>
          {showHighlightDropdown && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-card border-2 border-foreground shadow-lg z-50">
              <div className="flex gap-1">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-6 h-6 border-2 ${
                      highlightColor === color.value ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => {
                      onHighlightColorChange(color.value);
                      setShowHighlightDropdown(false);
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Underline - only enabled when text tool is active */}
        <ToolButton
          active={!!isUnderlineActive}
          onClick={() => onToggleUnderline?.()}
          title={activeTool === "text" ? "Underline" : "Select text first"}
          disabled={activeTool !== "text"}
        >
          <span className="font-bold text-sm underline">U</span>
        </ToolButton>

        {/* Strikethrough - only enabled when text tool is active */}
        <ToolButton
          active={!!isStrikethroughActive}
          onClick={() => onToggleStrikethrough?.()}
          title={activeTool === "text" ? "Strikethrough" : "Select text first"}
          disabled={activeTool !== "text"}
        >
          <span className="font-bold text-sm line-through">S</span>
        </ToolButton>

        <div className="w-px h-6 bg-foreground/20 mx-1" />

        {/* Draw Tool */}
        <ToolButton active={activeTool === "draw"} onClick={() => onToolChange("draw")} title="Draw (D)">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </ToolButton>

        {/* Shape Tool with dropdown */}
        <div className="relative" data-dropdown>
          <ToolButton
            active={isShapeTool}
            onClick={() => onToolChange("shape-rect")}
            title="Shapes"
            hasDropdown
            onDropdownClick={toggleShapeDropdown}
          >
            <span className="text-sm">□</span>
          </ToolButton>
          {showShapeDropdown && (
            <div className="absolute top-full left-0 mt-1 p-1 bg-card border-2 border-foreground shadow-lg z-50">
              {SHAPE_TOOLS.map((shape) => (
                <button
                  key={shape.tool}
                  type="button"
                  className={`w-full px-3 py-1.5 text-left text-sm font-medium flex items-center gap-2 hover:bg-muted ${
                    activeTool === shape.tool ? "bg-muted" : ""
                  }`}
                  onClick={() => {
                    onToolChange(shape.tool);
                    setShowShapeDropdown(false);
                  }}
                >
                  <span className="w-4 text-center">{shape.icon}</span>
                  {shape.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stroke Color Picker (for draw & shapes) */}
        <label
          className="relative w-8 h-8 cursor-pointer border-2 border-foreground/20 hover:border-foreground/50 transition-colors flex items-center justify-center"
          title="Stroke color (Draw & Shapes)"
        >
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => onStrokeColorChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="w-5 h-5 border border-foreground/30" style={{ backgroundColor: strokeColor }} />
        </label>

        <div className="w-px h-6 bg-foreground/20 mx-1" />

        {/* Stamp Tool with dropdown */}
        <div className="relative" data-dropdown>
          <ToolButton active={activeTool === "stamp"} onClick={toggleStampDropdown} title="Stamps">
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 22h14" />
              <path d="M12 17v5" />
              <path d="M8 17h8" />
              <rect x="6" y="10" width="12" height="7" rx="1" />
              <path d="M10 10V6a2 2 0 1 1 4 0v4" />
            </svg>
          </ToolButton>
          {showStampDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-card border-2 border-foreground shadow-[4px_4px_0_0_#1A1612] z-50 w-[220px]">
              {/* Shape & Color */}
              <div className="p-3 border-b-2 border-foreground">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shape</span>
                  <div className="flex border-2 border-foreground">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-bold ${
                        stampShape === "rect" ? "bg-foreground text-background" : "hover:bg-accent"
                      }`}
                      onClick={() => setStampShape("rect")}
                    >
                      Rect
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs font-bold border-l-2 border-foreground ${
                        stampShape === "circle" ? "bg-foreground text-background" : "hover:bg-accent"
                      }`}
                      onClick={() => setStampShape("circle")}
                    >
                      Oval
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color</span>
                  <div className="flex gap-1">
                    {STAMP_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-5 h-5 border-2 ${
                          stampColor === color.value ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setStampColor(color.value)}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Stamps */}
              <div className="max-h-[180px] overflow-y-auto">
                {STAMPS.map((stamp) => (
                  <button
                    key={stamp}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm font-bold hover:bg-accent border-b border-foreground/10 transition-colors"
                    style={{ color: stampColor }}
                    onClick={() => {
                      onStampSelect({ text: stamp, color: stampColor, shape: stampShape });
                      closeAllDropdowns();
                    }}
                  >
                    {stamp}
                  </button>
                ))}
                {customStamps.map((stamp) => (
                  <div key={stamp} className="flex items-center border-b border-foreground/10 group">
                    <button
                      type="button"
                      className="flex-1 px-3 py-2 text-left text-sm font-bold hover:bg-accent transition-colors"
                      style={{ color: stampColor }}
                      onClick={() => {
                        onStampSelect({ text: stamp, color: stampColor, shape: stampShape });
                        closeAllDropdowns();
                      }}
                    >
                      {stamp}
                    </button>
                    <button
                      type="button"
                      className="px-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => removeCustomStamp(stamp)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Custom */}
              <div className="p-2 border-t-2 border-foreground">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customStampText}
                    onChange={(e) => setCustomStampText(e.target.value.toUpperCase())}
                    placeholder="Custom text"
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm font-bold bg-card border-2 border-foreground focus:shadow-[2px_2px_0_0_#C84C1C] focus:translate-x-[-1px] focus:translate-y-[-1px] outline-none transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customStampText.trim()) {
                        saveCustomStamp(customStampText);
                        onStampSelect({ text: customStampText.trim(), color: stampColor, shape: stampShape });
                        setCustomStampText("");
                        closeAllDropdowns();
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        closeAllDropdowns();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!customStampText.trim()}
                    className="px-3 py-1.5 text-sm font-bold bg-primary text-white border-2 border-foreground hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[2px_2px_0_0_#1A1612] disabled:opacity-30 disabled:hover:transform-none disabled:hover:shadow-none transition-all"
                    onClick={() => {
                      if (customStampText.trim()) {
                        saveCustomStamp(customStampText);
                        onStampSelect({ text: customStampText.trim(), color: stampColor, shape: stampShape });
                        setCustomStampText("");
                        closeAllDropdowns();
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-foreground/20 mx-1" />

        {/* Image Tool */}
        <label
          className={`w-8 h-8 flex items-center justify-center border-2 cursor-pointer transition-colors ${
            activeTool === "image"
              ? "bg-primary text-white border-primary"
              : "bg-card border-foreground/20 hover:border-foreground/50"
          }`}
          title="Insert Image"
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                onImageSelect(ev.target?.result as string);
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </label>

        {/* Whiteout Tool */}
        <ToolButton active={activeTool === "whiteout"} onClick={() => onToolChange("whiteout")} title="Whiteout">
          <div className="w-4 h-4 bg-white border-2 border-foreground/30" />
        </ToolButton>

        {/* Redact Tool */}
        <ToolButton active={activeTool === "redact"} onClick={() => onToolChange("redact")} title="Redact">
          <div className="w-4 h-4 bg-foreground" />
        </ToolButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo/Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="w-8 h-8 flex items-center justify-center border-2 border-foreground/20 hover:border-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="w-8 h-8 flex items-center justify-center border-2 border-foreground/20 hover:border-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </button>

        <div className="w-px h-6 bg-foreground/20 mx-2" />

        {/* Change file button */}
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          Change file
        </button>
      </div>
    </div>
  );
}

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  hasDropdown?: boolean;
  onDropdownClick?: () => void;
  disabled?: boolean;
}

const ToolButton = memo(function ToolButton({
  active,
  onClick,
  title,
  children,
  hasDropdown,
  onDropdownClick,
  disabled,
}: ToolButtonProps) {
  return (
    <div className="flex">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={title}
        className={`w-8 h-8 flex items-center justify-center border-2 transition-colors ${
          disabled
            ? "opacity-30 cursor-not-allowed bg-card border-foreground/20"
            : active
              ? "bg-primary text-white border-primary"
              : "bg-card border-foreground/20 hover:border-foreground/50"
        } ${hasDropdown ? "rounded-l border-r-0" : ""}`}
      >
        {children}
      </button>
      {hasDropdown && (
        <button
          type="button"
          onClick={onDropdownClick}
          className={`w-5 h-8 flex items-center justify-center border-2 border-l-0 transition-colors ${
            active ? "bg-primary text-white border-primary" : "bg-card border-foreground/20 hover:border-foreground/50"
          }`}
        >
          <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>
      )}
    </div>
  );
});

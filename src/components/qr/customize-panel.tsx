"use client";

import { memo, useCallback, useRef } from "react";
import { QR_COLOR_PRESETS } from "@/lib/qr-utils";

const ChevronDownIcon = memo(function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
});

const ImageIcon = memo(function ImageIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
});

interface QRCustomizePanelProps {
  showCustomize: boolean;
  setShowCustomize: (show: boolean) => void;
  darkColor: string;
  setDarkColor: (color: string) => void;
  lightColor: string;
  setLightColor: (color: string) => void;
  logo: File | null;
  setLogo: (logo: File | null) => void;
  logoPreview: string | null;
  setLogoPreview: (preview: string | null) => void;
  logoPadding: boolean;
  setLogoPadding: (padding: boolean) => void;
}

export const QRCustomizePanel = memo(function QRCustomizePanel({
  showCustomize,
  setShowCustomize,
  darkColor,
  setDarkColor,
  lightColor,
  setLightColor,
  logo,
  setLogo,
  logoPreview,
  setLogoPreview,
  logoPadding,
  setLogoPadding,
}: QRCustomizePanelProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  const applyPreset = useCallback(
    (preset: (typeof QR_COLOR_PRESETS)[0]) => {
      setDarkColor(preset.dark);
      setLightColor(preset.light);
    },
    [setDarkColor, setLightColor],
  );

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setLogo(file);
        setLogoPreview(URL.createObjectURL(file));
      }
    },
    [setLogo, setLogoPreview],
  );

  const handleRemoveLogo = useCallback(() => {
    setLogo(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }, [setLogo, logoPreview, setLogoPreview]);

  // Toggle handler
  const handleToggle = useCallback(() => {
    setShowCustomize(!showCustomize);
  }, [showCustomize, setShowCustomize]);

  // Color handlers
  const handleDarkColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDarkColor(e.target.value);
    },
    [setDarkColor],
  );

  const handleLightColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLightColor(e.target.value);
    },
    [setLightColor],
  );

  return (
    <div className="border-2 border-foreground overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-foreground flex items-center justify-center">
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <span className="font-bold tracking-wide">CUSTOMIZE</span>
        </div>
        <ChevronDownIcon className={`w-5 h-5 transition-transform duration-200 ${showCustomize ? "rotate-180" : ""}`} />
      </button>

      {showCustomize && (
        <div className="border-t-2 border-foreground">
          {/* Color Presets */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-foreground" />
              <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Presets</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {QR_COLOR_PRESETS.map((preset) => {
                const isActive = darkColor === preset.dark && lightColor === preset.light;
                return (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={`group/preset relative aspect-square border-2 transition-all ${
                      isActive
                        ? "border-foreground ring-2 ring-foreground ring-offset-2"
                        : "border-foreground/30 hover:border-foreground"
                    }`}
                    title={preset.name}
                  >
                    <div className="absolute inset-0 grid grid-cols-2">
                      <div style={{ background: preset.dark }} />
                      <div style={{ background: preset.light }} />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/preset:opacity-100 transition-opacity bg-black/60">
                      <span className="text-[9px] font-bold text-white tracking-tight">{preset.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="p-4 border-t-2 border-foreground/20 bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-4 bg-foreground" />
              <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Custom</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <span className="flex items-center gap-3 p-2 border-2 border-foreground/30 hover:border-foreground transition-colors cursor-pointer group/color">
                <input
                  type="color"
                  value={darkColor}
                  onChange={handleDarkColorChange}
                  className="w-8 h-8 border-2 border-foreground cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block">FG</span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{darkColor}</span>
                </div>
              </span>
              <span className="flex items-center gap-3 p-2 border-2 border-foreground/30 hover:border-foreground transition-colors cursor-pointer group/color">
                <input
                  type="color"
                  value={lightColor}
                  onChange={handleLightColorChange}
                  className="w-8 h-8 border-2 border-foreground cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block">BG</span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{lightColor}</span>
                </div>
              </span>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="p-4 border-t-2 border-foreground/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-4 bg-foreground" />
              <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Logo</span>
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            {logoPreview ? (
              <div className="flex items-center gap-4 p-3 border-2 border-dashed border-foreground/30 bg-muted/20">
                <div className="w-14 h-14 border-2 border-foreground bg-white flex items-center justify-center overflow-hidden">
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm font-bold truncate">{logo?.name}</p>
                  <span className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      className={`w-4 h-4 border-2 border-foreground flex items-center justify-center transition-colors ${logoPadding ? "bg-foreground" : "bg-transparent"}`}
                    >
                      {logoPadding && (
                        <svg
                          aria-hidden="true"
                          className="w-3 h-3 text-background"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={logoPadding}
                      onChange={(e) => setLogoPadding(e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-xs font-medium">White padding</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="p-2 border-2 border-foreground/30 hover:border-foreground hover:bg-red-500/10 transition-colors"
                  title="Remove logo"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-foreground/30 hover:border-foreground hover:bg-muted/30 transition-all flex items-center justify-center gap-3 group/upload"
              >
                <div className="w-10 h-10 border-2 border-foreground/50 group-hover/upload:border-foreground flex items-center justify-center transition-colors">
                  <ImageIcon className="w-5 h-5 text-muted-foreground group-hover/upload:text-foreground transition-colors" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">Add Logo</span>
                  <span className="text-xs text-muted-foreground">Center overlay on QR</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

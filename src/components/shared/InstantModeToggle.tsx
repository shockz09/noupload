"use client";

import { memo, useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "noupload-instant-mode";

// Global state for cross-component sync
const globalListeners: Set<(value: boolean) => void> = new Set();

export function useInstantMode() {
  const [isInstant, setIsInstant] = useState(false); // Default OFF for new users
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsInstant(stored === "true");
    }
    // Default stays false if nothing stored
    setIsLoaded(true);

    // Subscribe to global changes
    const listener = (value: boolean) => setIsInstant(value);
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => {
    const newValue = !isInstant;
    setIsInstant(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    // Notify all listeners
    globalListeners.forEach((listener) => listener(newValue));
  }, [isInstant]);

  return { isInstant, toggle, isLoaded };
}

interface InstantModeToggleProps {
  isInstant: boolean;
  onToggle: () => void;
}

// Page-level toggle (larger, with text) - keep for backwards compat
export const InstantModeToggle = memo(function InstantModeToggle({ isInstant, onToggle }: InstantModeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        group relative flex items-center gap-3 px-4 py-2 border-2 border-foreground
        transition-all duration-200 select-none
        ${
          isInstant
            ? "bg-foreground text-background hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#1a1a1a]"
            : "bg-background text-foreground hover:bg-muted"
        }
      `}
    >
      <div className={`relative transition-transform duration-200 ${isInstant ? "scale-110" : ""}`}>
        <svg
          aria-hidden="true"
          className={`w-5 h-5 transition-all duration-200 ${isInstant ? "text-yellow-400" : "text-muted-foreground"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <span className="font-bold text-sm uppercase tracking-wider">{isInstant ? "Instant" : "Manual"}</span>
      <div
        className={`
        w-10 h-5 border-2 relative transition-colors duration-200
        ${isInstant ? "border-background/50 bg-background/20" : "border-foreground/30 bg-muted"}
      `}
      >
        <div
          className={`
          absolute top-0.5 w-3.5 h-3.5 transition-all duration-200
          ${isInstant ? "left-[calc(100%-16px)] bg-yellow-400" : "left-0.5 bg-foreground/40"}
        `}
        />
      </div>
    </button>
  );
});

// Navbar compact toggle (icon-only with animation)
export const InstantModeNavToggle = memo(function InstantModeNavToggle() {
  const { isInstant, toggle, isLoaded } = useInstantMode();
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    setIsPressed(true);
    toggle();
    setTimeout(() => setIsPressed(false), 150);
  };

  if (!isLoaded) return <div className="w-9 h-9" />;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isInstant ? "Instant Mode: ON" : "Instant Mode: OFF"}
      className={`
        group relative w-9 h-9 border-2 border-foreground
        transition-all duration-100 select-none
        ${
          isInstant
            ? "bg-primary hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_0_#1A1612]"
            : "bg-background hover:bg-muted"
        }
        ${isPressed ? "scale-90" : ""}
      `}
    >
      {/* Lightning bolt */}
      <div className="flex items-center justify-center h-full">
        <svg
          aria-hidden="true"
          className={`
            w-4 h-4 transition-all duration-100
            ${isInstant ? "text-primary-foreground" : "text-muted-foreground"}
          `}
          viewBox="0 0 24 24"
          fill={isInstant ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={isInstant ? "0" : "2.5"}
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
    </button>
  );
});

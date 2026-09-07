import { memo, useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "noupload-dock";
// The dock used to be "instant mode", which also auto-processed files on drop.
// Read the old key so anyone who had it on keeps the dock instead of losing it.
const LEGACY_STORAGE_KEY = "noupload-instant-mode";

// Global state for cross-component sync
const globalListeners: Set<(value: boolean) => void> = new Set();

export function useDock() {
  const [isDockEnabled, setIsDockEnabled] = useState(false); // Default OFF for new users
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored !== null) {
      setIsDockEnabled(stored === "true");
    }
    // Default stays false if nothing stored
    setIsLoaded(true);

    // Subscribe to global changes
    const listener = (value: boolean) => setIsDockEnabled(value);
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => {
    const newValue = !isDockEnabled;
    setIsDockEnabled(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    // Notify all listeners
    globalListeners.forEach((listener) => listener(newValue));
  }, [isDockEnabled]);

  return { isDockEnabled, toggle, isLoaded };
}

// Navbar compact toggle (icon-only with animation)
export const DockNavToggle = memo(function DockNavToggle() {
  const { isDockEnabled, toggle, isLoaded } = useDock();
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
      title={isDockEnabled ? "Dock: ON — results stay here" : "Dock: OFF"}
      className={`
        group relative w-9 h-9 border-2 border-foreground
        transition-all duration-100 select-none
        ${
          isDockEnabled
            ? "bg-primary hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_0_#1A1612]"
            : "bg-background hover:bg-muted"
        }
        ${isPressed ? "scale-90" : ""}
      `}
    >
      {/* Files resting on a dock. Deliberately not an arrow-into-tray glyph,
          which would read as "download" next to the app's real download buttons. */}
      <div className="flex items-center justify-center h-full">
        <svg
          aria-hidden="true"
          className={`
            w-4 h-4 transition-all duration-100
            ${isDockEnabled ? "text-primary-foreground" : "text-muted-foreground"}
          `}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          {/* two files, different heights */}
          <rect x="4.5" y="8.5" width="6.5" height="11" />
          <rect x="13" y="12.5" width="6.5" height="7" />
          {/* the dock they sit on */}
          <rect x="2" y="19.5" width="20" height="2.5" />
        </svg>
      </div>
    </button>
  );
});

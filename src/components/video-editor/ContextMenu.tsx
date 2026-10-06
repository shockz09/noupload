// Right-click menu for the editor: clips, empty track space, track headers and markers.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem =
  | { label: string; shortcut?: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
  | "sep";

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  // Keep the menu on screen near the pointer.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)),
    });
  }, [menu]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[60] min-w-52 py-1 border-2 border-foreground bg-card shadow-[4px_4px_0_0_var(--foreground)] select-none"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item, i) =>
        item === "sep" ? (
          <div key={`sep-${i}`} className="my-1 border-t border-foreground/15" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`w-full h-8 px-3 flex items-center justify-between gap-6 text-left text-xs font-bold transition-colors disabled:opacity-35 disabled:pointer-events-none ${
              item.danger ? "hover:bg-destructive hover:text-white" : "hover:bg-accent"
            }`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="font-mono text-[11px] text-muted-foreground">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  const getSection = () => {
    if (pathname?.startsWith("/image")) return { name: "image", href: "/image" };
    if (pathname?.startsWith("/audio")) return { name: "audio", href: "/audio" };
    if (pathname?.startsWith("/qr")) return { name: "qr", href: "/qr" };
    return { name: "pdf", href: "/" };
  };

  const section = getSection();

  return (
    <header className="header-main sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href={section.href} className="header-logo">
          noupload/<span>{section.name}</span>
        </a>
      </div>
    </header>
  );
}

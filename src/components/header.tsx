"use client";

import { memo, useMemo } from "react";
import { usePathname } from "next/navigation";
import { InstantModeNavToggle } from "@/components/shared/InstantModeToggle";

export const Header = memo(function Header() {
	const pathname = usePathname();

	const section = useMemo(() => {
		if (pathname?.startsWith("/image"))
			return { name: "image", href: "/image" };
		if (pathname?.startsWith("/audio"))
			return { name: "audio", href: "/audio" };
		if (pathname?.startsWith("/qr")) return { name: "qr", href: "/qr" };
		return { name: "pdf", href: "/" };
	}, [pathname]);

	return (
		<header className="header-main sticky top-0 z-50">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
				<a href={section.href} className="header-logo">
					noupload/<span>{section.name}</span>
				</a>
				<InstantModeNavToggle />
			</div>
		</header>
	);
});

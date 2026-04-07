import { Link, useLocation } from "@tanstack/react-router";
import { memo, useMemo } from "react";
import { BufferDock } from "@/components/file-buffer";
import { InstantModeNavToggle } from "@/components/shared/InstantModeToggle";

export const Header = memo(function Header() {
	const location = useLocation();
	const pathname = location.pathname;

	const section = useMemo(() => {
		if (pathname?.startsWith("/image")) return { name: "image", href: "/image" };
		if (pathname?.startsWith("/audio")) return { name: "audio", href: "/audio" };
		if (pathname?.startsWith("/qr")) return { name: "qr", href: "/qr" };
		if (pathname === "/") return null;
		return { name: "pdf", href: "/" };
	}, [pathname]);

	return (
		<>
			<header className="header-main sticky top-0 z-50">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
					<Link to="/" className="header-logo">
						noupload{section && <span>/{section.name}</span>}
					</Link>
					<div className="flex items-center gap-2">
						<InstantModeNavToggle />
					</div>
				</div>
			</header>
			<BufferDock />
		</>
	);
});

import { HeadContent, Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect } from "react";
import { Header } from "@/components/header";

const VercelAnalytics = lazy(() => import("@vercel/analytics/react").then((mod) => ({ default: mod.Analytics })));

function RootComponent() {
	return (
		<>
			<HeadContent />
			<div className="min-h-screen bg-background flex flex-col">
				{/* Paper texture overlay */}
				<div className="paper-texture" />

				{/* Header */}
				<Header />

				<main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
					<Outlet />
				</main>

				{/* Footer */}
				<footer className="border-t-2 border-foreground mt-auto">
					<div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
						<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
							<p className="text-sm text-muted-foreground font-medium">
								Your files never leave your device. Built for privacy.
							</p>
							<p className="text-xs text-muted-foreground/50">
								by{" "}
								<a
									href="https://github.com/shockz09"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground transition-colors"
								>
									Rohit Mishra
								</a>
							</p>
						</div>
					</div>
				</footer>
				<Suspense>
					<VercelAnalytics />
				</Suspense>
			</div>
		</>
	);
}

// ── 404 Page ────────────────────────────────────────────

function FileIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<path d="M14 2v6h6" />
		</svg>
	);
}

function ImageIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="18" height="18" rx="3" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<path d="M21 15l-5-5L5 21" />
		</svg>
	);
}

function AudioIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
	);
}

function HomeIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<polyline points="9 22 9 12 15 12 15 22" />
		</svg>
	);
}

function NotFoundPage() {
	return (
		<div className="min-h-[75vh] flex flex-col items-center justify-center px-4 -mt-6">
			{/* Main 404 Section */}
			<div className="text-center space-y-8 max-w-xl">
				{/* Animated "Lost File" Visual */}
				<div className="relative inline-block">
					{/* Paper/Document Background */}
					<div className="relative">
						{/* Shadow layers for depth */}
						<div className="absolute inset-0 translate-x-3 translate-y-3 bg-foreground/20 border-2 border-foreground" />
						<div className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-foreground/10 border-2 border-foreground" />

						{/* Main "document" */}
						<div className="relative bg-background border-2 border-foreground p-8 sm:p-12">
							{/* Torn edge effect at top */}
							<div
								className="absolute -top-[2px] left-4 right-4 h-3 bg-background border-x-2 border-t-2 border-foreground"
								style={{
									clipPath:
										"polygon(0% 100%, 5% 40%, 10% 100%, 15% 60%, 20% 100%, 25% 30%, 30% 100%, 35% 50%, 40% 100%, 45% 40%, 50% 100%, 55% 60%, 60% 100%, 65% 30%, 70% 100%, 75% 50%, 80% 100%, 85% 40%, 90% 100%, 95% 60%, 100% 100%)",
								}}
							/>

							{/* Question mark watermark */}
							<div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
								<span className="text-[20rem] font-display font-bold">?</span>
							</div>

							{/* 404 Number */}
							<div className="relative">
								<span className="text-8xl sm:text-9xl font-display font-bold tracking-tighter text-foreground">
									404
								</span>
							</div>

							{/* Decorative lines like document content */}
							<div className="mt-6 space-y-2 opacity-20">
								<div className="h-2 bg-foreground w-3/4 mx-auto" />
								<div className="h-2 bg-foreground w-1/2 mx-auto" />
								<div className="h-2 bg-foreground w-2/3 mx-auto" />
							</div>
						</div>
					</div>
				</div>

				{/* Message */}
				<div className="space-y-3">
					<h1 className="text-2xl sm:text-3xl font-display">This page got shredded</h1>
					<p className="text-muted-foreground text-lg">
						We looked everywhere, but this file doesn&apos;t exist.
						<br />
						Maybe it was never meant to be.
					</p>
				</div>

				{/* Primary CTA */}
				<Link to="/" className="btn-primary inline-flex">
					<HomeIcon className="w-5 h-5" />
					Back to Home
				</Link>

				{/* Tool Links */}
				<div className="pt-4 border-t-2 border-foreground/10">
					<p className="text-sm text-muted-foreground mb-4 font-medium">Or jump to a tool section</p>
					<div className="flex flex-wrap justify-center gap-3">
						<Link
							to="/"
							className="group flex items-center gap-2 px-4 py-2 border-2 border-foreground bg-background font-bold text-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_0_#1a1a1a] transition-all"
						>
							<FileIcon className="w-4 h-4" />
							PDF Tools
						</Link>
						<Link
							to="/image"
							className="group flex items-center gap-2 px-4 py-2 border-2 border-foreground bg-background font-bold text-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_0_#1a1a1a] transition-all"
						>
							<ImageIcon className="w-4 h-4" />
							Image Tools
						</Link>
						<Link
							to="/audio"
							className="group flex items-center gap-2 px-4 py-2 border-2 border-foreground bg-background font-bold text-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0_0_#1a1a1a] transition-all"
						>
							<AudioIcon className="w-4 h-4" />
							Audio Tools
						</Link>
					</div>
				</div>
			</div>

			{/* Floating decorative elements */}
			<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
				{/* Scattered "lost" document fragments */}
				<div className="absolute top-[10%] left-[5%] w-8 h-10 border-2 border-foreground/10 rotate-12 bg-background/50" />
				<div className="absolute top-[20%] right-[10%] w-6 h-8 border-2 border-foreground/10 -rotate-6 bg-background/50" />
				<div className="absolute bottom-[30%] left-[8%] w-10 h-12 border-2 border-foreground/10 rotate-45 bg-background/50" />
				<div className="absolute bottom-[15%] right-[15%] w-7 h-9 border-2 border-foreground/10 -rotate-12 bg-background/50" />
				<div className="absolute top-[40%] right-[5%] w-5 h-6 border-2 border-foreground/10 rotate-[30deg] bg-background/50" />
			</div>
		</div>
	);
}

// ── Error Page ──────────────────────────────────────────

function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
	useEffect(() => {
		console.error("Application error:", error);
	}, [error]);

	return (
		<div className="min-h-[60vh] flex items-center justify-center p-8">
			<div className="max-w-md w-full space-y-6 text-center">
				<div className="w-16 h-16 mx-auto border-2 border-foreground bg-red-50 flex items-center justify-center">
					<svg
						aria-hidden="true"
						className="w-8 h-8 text-red-600"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				</div>

				<div className="space-y-2">
					<h2 className="text-2xl font-display">Something went wrong</h2>
					<p className="text-muted-foreground">
						An unexpected error occurred. Your files are safe and haven&apos;t been uploaded anywhere.
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<button type="button" onClick={reset} className="btn-primary w-full">
						Try Again
					</button>
					<Link to="/" className="btn-secondary w-full inline-flex items-center justify-center">
						Go Home
					</Link>
				</div>
			</div>
		</div>
	);
}

// ── Route Definition ────────────────────────────────────

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ title: "noupload — Free Private PDF, Audio & Image Tools" },
			{
				name: "description",
				content:
					"Free online PDF editor, audio converter, and image tools that work 100% in your browser. No uploads, no servers, complete privacy. Merge, split, compress, sign PDFs and more.",
			},
			{
				name: "keywords",
				content:
					"pdf editor, pdf tools, merge pdf, split pdf, compress pdf, sign pdf, pdf to image, image to pdf, audio converter, audio trimmer, online pdf editor, free pdf tools, private pdf editor, no upload pdf, browser pdf editor, offline pdf tools, secure pdf editor",
			},
			{ property: "og:title", content: "noupload — Free Private PDF, Audio & Image Tools" },
			{
				property: "og:description",
				content:
					"Free online PDF editor, audio converter, and image tools that work 100% in your browser. No uploads, complete privacy.",
			},
			{ property: "og:url", content: "https://noupload.xyz" },
			{ property: "og:site_name", content: "noupload" },
			{ property: "og:locale", content: "en_US" },
			{ property: "og:type", content: "website" },
			{ property: "og:image", content: "https://noupload.xyz/og/default.svg" },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: "noupload — Free Private PDF Tools" },
			{
				name: "twitter:description",
				content: "Free online PDF editor that works 100% in your browser. No uploads, complete privacy.",
			},
			{ name: "twitter:image", content: "https://noupload.xyz/og/default.svg" },
			{ name: "robots", content: "index, follow" },
			{ name: "google-site-verification", content: "OWaTye3SWEfTh3CT7b0uRkM4W9APkZSM4z4UrgBvFnA" },
		],
	}),
	component: RootComponent,
	notFoundComponent: NotFoundPage,
	errorComponent: ErrorPage,
});

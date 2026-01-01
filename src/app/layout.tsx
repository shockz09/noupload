import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";

export const metadata: Metadata = {
	title: {
		default: "noupload — Free Private PDF, Audio & Image Tools",
		template: "%s | noupload",
	},
	description:
		"Free online PDF editor, audio converter, and image tools that work 100% in your browser. No uploads, no servers, complete privacy. Merge, split, compress, sign PDFs and more.",
	keywords: [
		"pdf editor",
		"pdf tools",
		"merge pdf",
		"split pdf",
		"compress pdf",
		"sign pdf",
		"pdf to image",
		"image to pdf",
		"audio converter",
		"audio trimmer",
		"online pdf editor",
		"free pdf tools",
		"private pdf editor",
		"no upload pdf",
		"browser pdf editor",
		"offline pdf tools",
		"secure pdf editor",
	],
	authors: [{ name: "noupload" }],
	creator: "noupload",
	publisher: "noupload",
	metadataBase: new URL("https://noupload.xyz"),
	alternates: {
		canonical: "/",
	},
	// Icons are auto-generated from icon.tsx and apple-icon.tsx
	manifest: "/manifest.json",
	openGraph: {
		title: "noupload — Free Private PDF, Audio & Image Tools",
		description:
			"Free online PDF editor, audio converter, and image tools that work 100% in your browser. No uploads, complete privacy.",
		url: "https://noupload.xyz",
		siteName: "noupload",
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "noupload — Free Private PDF Tools",
		description:
			"Free online PDF editor that works 100% in your browser. No uploads, complete privacy.",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	verification: {
		google: "OWaTye3SWEfTh3CT7b0uRkM4W9APkZSM4z4UrgBvFnA",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link
					rel="preconnect"
					href="https://fonts.googleapis.com"
					crossOrigin="anonymous"
				/>
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Onest:wght@300;400;500;600;700;800&display=swap"
					rel="stylesheet"
					crossOrigin="anonymous"
				/>
			</head>
			<body className="min-h-screen bg-background">
				{/* Paper texture overlay */}
				<div className="paper-texture" />

				{/* Header */}
				<Header />

				<main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
					{children}
				</main>

				{/* Footer */}
				<footer className="border-t-2 border-foreground mt-auto">
					<div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
						<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
							<p className="text-sm text-muted-foreground font-medium">
								Your files never leave your device. Built for privacy.
							</p>
							<div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
								<span className="w-2.5 h-2.5 bg-[#2D5A3D] animate-pulse" />
								All processing local
							</div>
						</div>
					</div>
				</footer>
				<Analytics />
			</body>
		</html>
	);
}

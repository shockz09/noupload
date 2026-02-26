import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Optimize barrel imports for faster builds and smaller bundles
	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"@radix-ui/react-dialog",
			"@radix-ui/react-label",
			"@radix-ui/react-progress",
			"@radix-ui/react-scroll-area",
			"@radix-ui/react-separator",
			"@radix-ui/react-slot",
			"@radix-ui/react-tabs",
		],
	},
	async redirects() {
		return [
			{
				source: "/pdf",
				destination: "/",
				permanent: true,
			},
		];
	},
	async headers() {
		return [
			{
				// Apply COOP/COEP globally for SharedArrayBuffer support
				// This enables cross-origin isolation site-wide
				source: "/:path*",
				headers: [
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin",
					},
					{
						key: "Cross-Origin-Embedder-Policy",
						value: "credentialless",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(self), microphone=(self), geolocation=()",
					},
					{
						key: "Content-Security-Policy",
						value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: data: https://cdn.jsdelivr.net https://unpkg.com https://va.vercel-scripts.com https://cdn.zetaoffice.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://va.vercel-scripts.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://unpkg.com https://huggingface.co https://*.huggingface.co https://*.hf.co https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.zetaoffice.net data: blob:; worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com https://cdn.zetaoffice.net; object-src 'none'; frame-ancestors 'none';",
					},
				],
			},
		];
	},
};

export default nextConfig;

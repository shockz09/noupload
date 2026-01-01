import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
				],
			},
		];
	},
};

export default nextConfig;

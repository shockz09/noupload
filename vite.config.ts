import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			// Keep dev-only route files out of a production build entirely.
			...(command === "build" ? { routeFileIgnorePattern: "design-system" } : {}),
		}),
		react(),
	],
	optimizeDeps: {
		// Pre-bundle what the compression workers import lazily. Without this, the
		// first compression of a session triggers "new dependency optimized →
		// reloading", and Vite reloads the page out from under the running job.
		include: ["@jsquash/jpeg/encode", "pdf-lib"],
		// mupdf ships ESM with top-level await and loads its own WASM relative to
		// import.meta.url; prebundling it breaks that, so keep it as-is.
		exclude: ["mupdf"],
	},
	worker: {
		// mupdf's WASM loader uses top-level await, which only survives the
		// worker bundle in ES module format (the default is IIFE).
		format: "es",
	},
	server: {
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "credentialless",
		},
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			// jsmediatags imports react-native-fs which doesn't exist in browser
			"react-native-fs": resolve(__dirname, "src/stubs/empty.ts"),
		},
	},
}));

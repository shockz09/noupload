import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
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
});

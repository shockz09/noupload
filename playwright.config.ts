import { defineConfig } from "@playwright/test";

// Port 5174 is reserved for the test server. It's deliberately not 5173 (the
// default `vite` port) — a stray dev server from another project sitting on
// 5173 used to get reused here, and every `import("/src/...")` in page.evaluate
// then resolved against *that* app and failed with "Failed to fetch
// dynamically imported module". strictPort + reuseExistingServer:false makes a
// port clash a loud startup error instead of a confusing test failure.
const PORT = 5174;

export default defineConfig({
	testDir: "./e2e",
	timeout: 90_000,
	retries: 0,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		headless: true,
	},
	webServer: {
		command: `pnpm dev --port ${PORT} --strictPort --host 127.0.0.1`,
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: false,
		timeout: 60_000,
	},
	// Chromium is the everyday target — `pnpm test` pins it. Firefox and WebKit are
	// opt-in (`pnpm test:all`, or --project=webkit) because they need their browsers
	// installed and they run several times slower: no native AAC encoder there, so
	// audio work falls back to the WASM encoder.
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
		{
			name: "firefox",
			use: { browserName: "firefox" },
		},
		{
			name: "webkit",
			use: { browserName: "webkit" },
		},
	],
});

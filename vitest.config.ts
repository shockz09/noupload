import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Deliberately not reusing vite.config.ts: the router plugin generates route
// trees and the react plugin sets up fast refresh, neither of which a pure
// logic test needs. Only the "@" alias matters here.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});

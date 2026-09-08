import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    fileParallelism: false,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./client/src"),
      "@shared": resolve(__dirname, "./shared"),
      "@server": resolve(__dirname, "./server"),
    },
  },
});

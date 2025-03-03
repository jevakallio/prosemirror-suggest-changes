import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  root: "./src",
  test: { environment: "jsdom" },
  build: {
    target: "esnext",
  },
});

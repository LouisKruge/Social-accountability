import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest needs the same "@/" alias tsconfig gives the app. Without it a module
 * that imports across the alias fails to LOAD, and vitest reports a failed
 * suite rather than failed tests — which is easy to skim past in a green-looking
 * summary. Keep this in step with tsconfig.json's `paths`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // See src/test/server-only-stub.ts.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});

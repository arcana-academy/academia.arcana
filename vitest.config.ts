import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      // Keep Vitest's own defaults (**/node_modules/**, **/.git/**): setting
      // "exclude" replaces them instead of extending them.
      ...configDefaults.exclude,
      // Parallel, git-ignored working copies of this repository that live next
      // to the source tree (see .gitignore). They carry their own src/ and
      // node_modules, so they must never be collected as project tests.
      "**/academiaarcana-clean/**",
      // Playwright owns the end-to-end suite (see playwright.config.ts,
      // testDir "./tests/e2e"). Anchored with "**/" so no copy of the tree can
      // smuggle a spec file back into the Vitest run.
      "**/tests/e2e/**",
      // The C96 contrast proof is a dedicated Playwright project.
      "**/tests/c96/**",
      // Native node:test suites run through their isolated workflow rather than
      // Vitest, which cannot observe node:test registrations.
      "**/scripts/qa/c03-synthetic-isolation.test.mjs",
      // Run native node:test canaries only with the dedicated isolated workflow.
      "**/scripts/security/test-build-secret-isolation-536.test.cjs",
      // C135: native node:test contract belongs to the dedicated #536 workflow.
      "**/scripts/security/test-docker-build-context-536.test.cjs",
      // F7/F8 closure-safety tests use node:test; run with node --test, not Vitest.
      "**/scripts/issue-triage/apply-f-series-triage.test.mjs",
    ],
  },
});

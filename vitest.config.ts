import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // `index.ts` and `build.ts` are re-export barrels with no logic of their own, and
      // `cli.ts` is the binary — CI runs it as a process, which coverage cannot see.
      exclude: ["src/index.ts", "src/build.ts", "src/cli.ts"],
      reporter: ["text", "html"],
      // Enforced, not merely reported. It was collected on every CI job and checked
      // nowhere, so a change could delete a suite's worth of coverage in silence. The
      // numbers are just below where the suite sits today: they are a ratchet against
      // losing ground, not a target to chase.
      thresholds: {
        statements: 93,
        branches: 86,
        functions: 93,
        lines: 95,
      },
    },
  },
});

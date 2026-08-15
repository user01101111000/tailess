import { build } from "esbuild";
import { describe, expect, it } from "vitest";

/**
 * What a consumer's bundler actually emits for the browser.
 *
 * Two things are worth pinning here. The dev-only warnings must survive into a
 * development build — they are the guarantee this package is built around, and a
 * mistake in the `isDev` plumbing would remove them silently. And the runtime must
 * stay small: the warning text cannot be dead-code-eliminated (see the note in
 * `src/internal/env.ts` for the two rejected ways to try), so its cost is fixed and
 * should not be allowed to creep.
 */

/** Bundle the public entry the way a consumer's bundler would. */
async function bundleFor(mode: "production" | "development"): Promise<string> {
  const result = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    // clsx and tailwind-merge are the consumer's to bundle; this is tailess' own cost.
    external: ["clsx", "tailwind-merge"],
    define: { "process.env.NODE_ENV": JSON.stringify(mode) },
  });
  return result.outputFiles?.[0]?.text ?? "";
}

/** A distinctive fragment of each warning, so a reworded message still matches. */
const warnings = [
  "doesn't include tailess",
  "not a Tailwind breakpoint",
  "empty prefix",
  "contains whitespace",
  "empty range",
];

describe("the browser bundle", () => {
  it("keeps every dev warning in a development build", async () => {
    const code = await bundleFor("development");
    for (const fragment of warnings) expect(code).toContain(fragment);
    expect(code).toContain("getComputedStyle");
  });

  it("stays within its size budget", async () => {
    const code = await bundleFor("production");
    // 4,857 chars minified today (~2.4 kB gzipped), roughly a fifth of which is the
    // warning text that cannot be eliminated. Raise this deliberately, and only for
    // something worth shipping to every consumer's users.
    expect(code.length).toBeLessThan(5_500);
  });

  it("pulls in no Node builtins", async () => {
    // This entry runs in the browser; a `node:` import here breaks web bundling.
    const code = await bundleFor("production");
    expect(code).not.toMatch(/require\(["']node:|from["']\s*node:/);
  });
});

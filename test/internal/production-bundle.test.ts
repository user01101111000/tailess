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
    // tailwind-merge is the consumer's to bundle; this is tailess' own cost. `clsx`
    // is no longer a dependency — `src/internal/join.ts` replaces it — so its bytes
    // are counted here rather than externalised.
    external: ["tailwind-merge"],
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
    // 6,165 chars minified today (~2.8 kB gzipped), roughly a fifth of which is the
    // warning text that cannot be eliminated. Raise this deliberately, and only for
    // something worth shipping to every consumer's users. Raised from 5,500 for
    // variadic arguments and nested buckets in `ss` — +634 chars, +270 gzipped — which
    // is what removed `cn(ss(…), …)` from every call site. Vendoring `clsx` as
    // `join` moved 135 chars in and a dependency out, and gzipped 35 bytes smaller.
    // Raised again from 6,000 for the container-query and `not-*` keys: +265 chars,
    // +100 gzipped, for 84 keys — container queries being the one Tailwind v4 feature
    // `ss` could not express at all. Deriving both families from a size list rather
    // than writing them out kept that number down by another 94.
    expect(code.length).toBeLessThan(6_400);
  });

  it("pulls in no Node builtins", async () => {
    // This entry runs in the browser; a `node:` import here breaks web bundling.
    const code = await bundleFor("production");
    expect(code).not.toMatch(/require\(["']node:|from["']\s*node:/);
  });
});

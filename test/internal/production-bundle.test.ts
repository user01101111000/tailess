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
  "false in every browser",
  "not valid CSS",
  "literal underscore",
  "not a CSS custom property",
  "letters, digits",
  "was given an empty",
  "positions count from 1",
  "empty feature query",
  "cannot appear in a class name",
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
    //
    // Raised from 6,400 for `supports`/`notSupports`/`vars`: 6,165 -> 8,219 chars,
    // 2,835 -> 3,660 gzipped. Most of that is warning text, and it buys five silent
    // failures a `withPrefix` spelling could not catch — a combined query missing a
    // pair of parentheses on either side (compiles, false in every browser), a
    // top-level `not` beside an `and` (invalid CSS, rule discarded), an empty query,
    // a character no class name can carry (the build enumerates nothing, so the
    // class has no rule), and a literal underscore (read as a space).
    //
    // Raised again to 9,300 for the named `group`/`peer`/`container` variants:
    // 8,219 -> 9,020 chars, 3,660 -> 3,978 gzipped. Names fail silently in several
    // ways — an empty one, a `/` or a `:` gets no rule at all, and a `.` emits a
    // parent matcher that reads as two classes — and a container name is stricter
    // again, because Tailwind writes it into `container-name:` and the `@container`
    // prelude where CSS demands a <custom-ident>. That second alphabet, and the
    // keyword list that goes with it, is most of the cost here.
    //
    // Raised again to 10,000 for the `has-*` / `in-*` key families and the
    // `has`/`notHas`/`inside` helpers: 9,020 -> 9,789 chars, 3,978 -> 4,179 gzipped.
    // Tailwind compounds both with exactly the 36 states `group-*` and `peer-*` use,
    // so the keys derive from one list rather than being written out, and 72 of them
    // cost 47 characters — which is the whole of what a consumer importing only `ss`
    // and `cn` pays, since `ss` needs the key order. The rest is the helpers.
    //
    // Raised again to 10,800 for the four `nth-*` helpers: 9,789 -> 10,510 chars,
    // 4,179 -> 4,440 gzipped. Less than it looks: the empty-value and unusable-character
    // checks `has`, `inside` and `supports` each carried a copy of now live in one
    // `internal/arbitrary.ts`, which paid for about half of what the four added.
    //
    // Raised again to 11,200 for `variants()`: 10,510 -> 10,935 chars, 4,440 -> 4,601
    // gzipped, and 425 of those characters are the whole recipe builder — it is a
    // wrapper over `ss`, not a second engine, which is the reason it costs so little
    // and the reason a variant option can be an `ss` map at all.
    //
    // Note what this number is and isn't: the package sets `sideEffects: false`, so
    // it is the cost of importing *everything*. A consumer using only `ss` and `cn`
    // bundles 5,170 chars — of which 47 are the two new key families — one adding
    // `vars` pays 488, and one importing only `variants` bundles 5,634. Measured,
    // not assumed.
    expect(code.length).toBeLessThan(11_200);
  });

  it("pulls in no Node builtins", async () => {
    // This entry runs in the browser; a `node:` import here breaks web bundling.
    const code = await bundleFor("production");
    expect(code).not.toMatch(/require\(["']node:|from["']\s*node:/);
  });
});

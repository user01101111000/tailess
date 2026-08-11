import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";
import { maxScreenKeys, screenKeys, screens, stateKeys } from "../src/constants.js";
import { hasRule } from "./helpers/css.js";

const require = createRequire(import.meta.url);
const tailwindDir = dirname(require.resolve("tailwindcss/package.json"));
const tailwindIndex = await readFile(join(tailwindDir, "index.css"), "utf8");

const loadStylesheet = async (id: string, base: string) => {
  if (id === "tailwindcss") return { base, path: "index.css", content: tailwindIndex };
  throw new Error(`unexpected stylesheet: ${id}`);
};

/** Compile a stylesheet that safelists `candidates`, and return the CSS. */
async function build(candidates: readonly string[]): Promise<string> {
  const compiler = await compile(
    `@import "tailwindcss";\n@source inline("${candidates.join(" ")}");\n`,
    { base: process.cwd(), loadStylesheet },
  );
  return compiler.build([]);
}

/**
 * Every key tailess autocompletes is checked against the Tailwind compiler that
 * has to understand it. A key that isn't a real variant is worse than no key at
 * all: autocomplete promises it works, and the browser silently disagrees.
 */
describe("built-in keys are real Tailwind variants", () => {
  it("every state key produces a rule", async () => {
    const css = await build(stateKeys.map((key) => `${key}:underline`));
    const broken = stateKeys.filter((key) => !hasRule(css, `${key}:underline`));
    expect(broken).toEqual([]);
  });

  it("every breakpoint key produces a rule", async () => {
    const css = await build(screenKeys.map((key) => `${key}:underline`));
    expect(screenKeys.filter((key) => !hasRule(css, `${key}:underline`))).toEqual([]);
  });

  it("every max-* key produces a rule", async () => {
    const css = await build(maxScreenKeys.map((key) => `${key}:underline`));
    expect(maxScreenKeys.filter((key) => !hasRule(css, `${key}:underline`))).toEqual([]);
  });

  it("rejects a variant that does not exist (the check discriminates)", async () => {
    const css = await build(["bogus-variant:underline"]);
    expect(hasRule(css, "bogus-variant:underline")).toBe(false);
  });

  it("breakpoint values match the media queries Tailwind actually emits", async () => {
    // `screens` is what a consumer feeds to `matchMedia`, so a drifted value would
    // silently disagree with the CSS. Compare against the real media query.
    const css = await build(screenKeys.map((key) => `${key}:underline`));
    for (const key of screenKeys) {
      // Tailwind emits the modern range form; Lightning CSS lowers it to
      // `min-width` later. Accept either so the assertion is about the value.
      expect(css, key).toMatch(
        new RegExp(`\\(\\s*(?:width >= ${screens[key]}|min-width:\\s*${screens[key]})\\s*\\)`),
      );
    }
  });
});

describe("key sets", () => {
  it("has no duplicates", () => {
    expect(new Set(stateKeys).size).toBe(stateKeys.length);
    expect(new Set(screenKeys).size).toBe(screenKeys.length);
  });

  it("keeps max-* keys largest-first, mirroring Tailwind's own ordering", () => {
    expect(maxScreenKeys).toEqual([...screenKeys].reverse().map((key) => `max-${key}`));
  });
});

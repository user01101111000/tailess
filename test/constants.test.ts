import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { __unstable__loadDesignSystem, compile } from "tailwindcss";
import { describe, expect, it } from "vitest";
import {
  containerKeys,
  maxContainerKeys,
  maxScreenKeys,
  screenKeys,
  screens,
  stateKeys,
} from "../src/constants.js";
import { hasRule } from "./helpers/css.js";

const require = createRequire(import.meta.url);
const tailwindDir = dirname(require.resolve("tailwindcss/package.json"));
const tailwindIndex = await readFile(join(tailwindDir, "index.css"), "utf8");

const loadStylesheet = async (id: string, base: string) => {
  if (id === "tailwindcss") return { base, path: "index.css", content: tailwindIndex };
  throw new Error(`unexpected stylesheet: ${id}`);
};

const design = await __unstable__loadDesignSystem(`@import "tailwindcss";`, {
  base: process.cwd(),
  loadStylesheet,
});

/** Every static variant Tailwind registers. */
const allStatic = [...design.variants.entries()]
  .filter(([, variant]) => variant.kind === "static")
  .map(([name]) => name);

/** …minus the breakpoints, which tailess models as their own key family. */
const plain = allStatic.filter((name) => !(screenKeys as readonly string[]).includes(name));

/**
 * The variants Tailwind lets you compound onto `prefix`.
 *
 * `group` and `peer` only reach the element's own state, so they are asked about the
 * `plain` set. `not` reaches further — a media query and a breakpoint can both be
 * negated — so it is asked about every static variant there is.
 */
const compoundable = (
  prefix: "group" | "peer" | "not" | "has" | "in",
  from: string[] = plain,
): string[] => from.filter((name) => design.variants.compoundsWith(prefix, name));

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

/**
 * The check above only proves every key we ship is real. It cannot notice a
 * variant Tailwind supports that we forgot — and a forgotten one is a compile
 * error for the consumer on a class that would have worked. So ask Tailwind's own
 * variant registry what exists and compare both directions.
 */
describe("built-in keys cover every static Tailwind variant", () => {
  const expected = [
    ...plain,
    ...compoundable("group").map((name) => `group-${name}`),
    ...compoundable("peer").map((name) => `peer-${name}`),
    ...compoundable("has").map((name) => `has-${name}`),
    ...compoundable("in").map((name) => `in-${name}`),
    ...compoundable("not", allStatic).map((name) => `not-${name}`),
  ].sort();

  it("lists exactly the variants Tailwind registers — no more, no fewer", () => {
    expect([...stateKeys].sort()).toEqual(expected);
  });

  it("keeps the four descendant/sibling families symmetric", () => {
    // Tailwind compounds all four with the same 36, so a name in one and not another
    // is always an oversight.
    expect(compoundable("has")).toEqual(compoundable("group"));
    expect(compoundable("in")).toEqual(compoundable("group"));
  });

  it("keeps the group-* and peer-* families symmetric", () => {
    // Tailwind compounds both with the same set, so a name in one and not the
    // other is always an oversight.
    expect(compoundable("group")).toEqual(compoundable("peer"));
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

/**
 * Container queries are a functional variant in Tailwind's registry — `@md` is `@`
 * given a size — so the registry comparison above cannot vouch for them, exactly as
 * it cannot for `max-*`. Compile them instead: the only proof that matters is a rule
 * coming out the other side.
 */
describe("container-query keys", () => {
  it("every container key produces a rule", async () => {
    const css = await build(containerKeys.map((key) => `${key}:underline`));
    expect(containerKeys.filter((key) => !hasRule(css, `${key}:underline`))).toEqual([]);
  });

  it("every @max-* container key produces a rule", async () => {
    const css = await build(maxContainerKeys.map((key) => `${key}:underline`));
    expect(maxContainerKeys.filter((key) => !hasRule(css, `${key}:underline`))).toEqual([]);
  });

  it("keeps @max-* largest-first, mirroring the viewport ranges", () => {
    expect(maxContainerKeys).toEqual(
      [...containerKeys].reverse().map((key) => key.replace("@", "@max-")),
    );
  });

  it("has no duplicates and does not collide with the viewport keys", () => {
    const all = [...containerKeys, ...maxContainerKeys, ...screenKeys, ...maxScreenKeys];
    expect(new Set(all).size).toBe(all.length);
  });
});

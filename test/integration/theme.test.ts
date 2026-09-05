import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  breakpointsIn,
  collectBreakpoints,
  collectTheme,
  customVariantsIn,
  themeDiagnostics,
} from "../../src/integration/theme.js";

/**
 * The breakpoint keys are compiled into the package — they have to be, since they are
 * a closed union the compiler checks and `screens` is read from JS for `matchMedia`.
 * A `@theme` block can move all of that underneath them, and three of the four ways
 * it can are completely silent. Each case below was confirmed against the real
 * Tailwind compiler before it was written down:
 *
 * - `--breakpoint-sm: initial` -> `sm:underline` gets no rule at all.
 * - `--breakpoint-*: initial`, `--*: initial` and `--breakpoint-s-*: initial` -> the
 *   same, for everything they cover.
 * - `--breakpoint-md: 50rem` -> the rule moves to `(width >= 50rem)`.
 * - `--breakpoint-3xl: 120rem` -> `3xl:` and `max-3xl:` both work.
 *
 * The other half of the suite is the silent half, and it matters more: a warning that
 * fires on working CSS teaches people to ignore warnings, and takes the other checks
 * down with it.
 */

const names = (css: string): string[] => breakpointsIn(css).map((d) => `${d.name}=${d.value}`);
const messages = (css: string): string[] =>
  themeDiagnostics(breakpointsIn(css)).map((d) => d.message);

describe("reading --breakpoint-* out of a stylesheet", () => {
  it("finds one inside @theme and ignores everything else there", () => {
    expect(names(`@theme {\n  --breakpoint-3xl: 120rem;\n  --color-x: red;\n}`)).toEqual([
      "3xl=120rem",
    ]);
  });

  it("handles @theme with a modifier", () => {
    // `@theme inline`, `@theme static` and `@theme reference` are all the same rule.
    expect(names(`@theme inline {\n --breakpoint-sm: initial;\n}`)).toEqual(["sm=initial"]);
    expect(names(`@THEME REFERENCE { --breakpoint-sm: initial; }`)).toEqual(["sm=initial"]);
  });

  it("keeps declarations in source order, since initial only removes what precedes it", () => {
    expect(names(`@theme { --breakpoint-md: 50rem; --breakpoint-*: initial; }`)).toEqual([
      "md=50rem",
      "*=initial",
    ]);
  });

  it("reads the whole-theme reset as well as the namespace one", () => {
    expect(names(`@theme { --*: initial; --breakpoint-md: 900px; }`)).toEqual([
      "*=initial",
      "md=900px",
    ]);
  });

  it("reads a partial namespace reset", () => {
    expect(names(`@theme { --breakpoint-sm-*: initial; }`)).toEqual(["sm-*=initial"]);
  });

  it("ignores a --breakpoint-* outside @theme, which defines no variant", () => {
    // Confirmed against the compiler: `md:` still lands at 48rem with this present.
    expect(names(`.a { --breakpoint-md: 1px }`)).toEqual([]);
  });

  it("does not match a longer token that merely starts with @theme", () => {
    // `\b` treats `-` and `/` as boundaries, so an aliased import or a package glob
    // used to swallow the next rule's body and report it as a theme.
    expect(names(`@import "@theme/tokens.css";\n:root { --breakpoint-md: 768px; }`)).toEqual([]);
    expect(
      names(`@source "../node_modules/@theme-ui/**";\n.c { --breakpoint-sm: initial }`),
    ).toEqual([]);
    expect(
      names(`.a { background: url("/img/@theme-dark.png") }\n.b { --breakpoint-3xl: 1rem }`),
    ).toEqual([]);
  });

  it("stops at the closing brace", () => {
    expect(names(`@theme { --breakpoint-md: 50rem; }\n.a { --breakpoint-lg: 1px }`)).toEqual([
      "md=50rem",
    ]);
  });

  it("finds nothing in an ordinary entry", () => {
    expect(names(`@import "tailwindcss";`)).toEqual([]);
  });

  it("ignores a commented-out declaration", () => {
    // Reporting one would be a warning fired at code already doing the right thing,
    // which is the failure mode this whole check exists to avoid.
    expect(
      names(`@theme {\n  /* --breakpoint-lg: 1px; */\n  --breakpoint-3xl: 120rem;\n}`),
    ).toEqual(["3xl=120rem"]);
  });

  it("survives a comment holding an unmatched brace", () => {
    expect(names(`@theme {\n /* } */\n --breakpoint-3xl: 120rem;\n}`)).toEqual(["3xl=120rem"]);
  });

  it("reads a minified block, and one with no trailing semicolon", () => {
    expect(names(`@theme{--breakpoint-3xl:120rem}`)).toEqual(["3xl=120rem"]);
    expect(names(`@theme { --breakpoint-3xl: 120rem }`)).toEqual(["3xl=120rem"]);
  });

  it("ignores a theme block written inside a string literal", () => {
    // No breakpoint value is ever quoted, so stripping strings first loses nothing —
    // and a `content:` or `url()` holding this text is not CSS the browser reads.
    expect(names(`.a::after { content: "@theme { --breakpoint-md: 1px; }" }`)).toEqual([]);
    expect(names(`.a { background: url('@theme { --breakpoint-sm: initial; }') }`)).toEqual([]);
  });

  it("says nothing at all when a @config defers part of the theme to JavaScript", () => {
    // A v3 config can set `theme.screens`, and that file is never opened — so the CSS
    // in hand is only half the input, and half an answer would be worse than none.
    expect(names(`@config "./tailwind.config.js";\n@theme { --breakpoint-md: 50rem; }`)).toEqual(
      [],
    );
    expect(
      messages(`@config "./tailwind.config.js";\n@theme { --breakpoint-sm: initial; }`),
    ).toEqual([]);
  });

  it("still answers when @config appears only inside a comment or a string", () => {
    expect(names(`/* @config "./old.js"; */\n@theme { --breakpoint-md: 50rem; }`)).toEqual([
      "md=50rem",
    ]);
  });

  it("does not choke on input that is not really CSS", () => {
    for (const css of ["", "@theme", "@theme {", "}".repeat(50), "@theme {".repeat(200)]) {
      expect(() => breakpointsIn(css)).not.toThrow();
    }
  });
});

describe("what the theme changed", () => {
  it("says nothing when there is no @theme", () => {
    expect(messages(`@import "tailwindcss";`)).toEqual([]);
  });

  it("says nothing when the theme restates a default", () => {
    // The bar is the same as the source diagnostics': report only what cannot work.
    expect(messages(`@theme { --breakpoint-md: 48rem; }`)).toEqual([]);
  });

  it("says nothing when the theme restates a default in the units v3 used", () => {
    // Pinning the v3 numbers in `@theme` is the standard v3 -> v4 migration, and
    // 768px is the width tailess already exports as 48rem — a media query resolves
    // rem against the initial font size, so the two are the same query. Warning here
    // fired five times on a build that was fine.
    expect(
      messages(`@theme {
        --breakpoint-sm: 640px;
        --breakpoint-md: 768px;
        --breakpoint-lg: 1024px;
        --breakpoint-xl: 1280px;
        --breakpoint-2xl: 1536px;
      }`),
    ).toEqual([]);
    expect(messages(`@theme { --breakpoint-md: 48em; }`)).toEqual([]);
  });

  it("still reports a width that really moved", () => {
    const [first, ...rest] = messages(`@theme { --breakpoint-md: 800px; }`);
    expect(rest).toEqual([]);
    expect(first).toContain('sets "md" to 800px');
    expect(messages(`@theme { --breakpoint-md: 47.9rem; }`)).toHaveLength(1);
    // Nothing to compare a non-length against, so it is reported rather than assumed.
    expect(messages(`@theme { --breakpoint-md: calc(48rem + 1px); }`)).toHaveLength(1);
  });

  it("says nothing about a theme that customises anything else", () => {
    expect(
      messages(`@theme { --color-brand: oklch(0.7 0.1 250); --font-display: serif; }`),
    ).toEqual([]);
  });

  it("reports a removed breakpoint, which is the silent one", () => {
    const [first, ...rest] = messages(`@theme { --breakpoint-sm: initial; }`);
    expect(rest).toEqual([]);
    expect(first).toContain('removes the "sm" breakpoint');
    expect(first).toContain("no rule is generated");
  });

  it("reports every breakpoint a namespace reset removes", () => {
    expect(messages(`@theme { --breakpoint-*: initial; }`)).toHaveLength(5);
  });

  it("reports every breakpoint the whole-theme reset removes", () => {
    // `--*: initial` is Tailwind's documented way to start from nothing.
    expect(messages(`@theme { --*: initial; }`)).toHaveLength(5);
  });

  it("reports what a partial reset removes, and only that", () => {
    // The clear is a prefix match, so `sm-*` takes `sm` itself with it.
    const found = messages(`@theme { --breakpoint-sm-*: initial; }`);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('removes the "sm" breakpoint');
  });

  it("honours where a reset sits relative to a key", () => {
    // Written after, the reset wins and `md` is gone; written before, `md` survives
    // at its new width. A set of values could not tell these apart.
    const after = messages(`@theme { --breakpoint-md: 50rem; --breakpoint-*: initial; }`);
    expect(after).toHaveLength(5);
    expect(after.every((m) => m.includes("removes"))).toBe(true);

    const before = messages(`@theme { --breakpoint-*: initial; --breakpoint-md: 50rem; }`);
    expect(before).toHaveLength(5);
    expect(before.filter((m) => m.includes('"md"'))[0]).toContain('sets "md" to 50rem');
  });

  it("reports a renamed set as removals plus one addition", () => {
    const found = messages(`@theme { --breakpoint-*: initial; --breakpoint-tablet: 40rem; }`);
    expect(found).toHaveLength(6);
    expect(found.filter((m) => m.includes("adds"))).toHaveLength(1);
  });

  it("reports a changed value, naming both", () => {
    // The classes still work; `screens.md` is what stops being true, and it is read
    // from JS where nothing can catch the disagreement.
    const [first] = messages(`@theme { --breakpoint-md: 50rem; }`);
    expect(first).toContain("50rem");
    expect(first).toContain("screens.md");
    expect(first).toContain("48rem");
  });

  it("reports an added breakpoint and names the escape hatch", () => {
    // This one is at least loud — `ss({ "3xl": … })` is a compile error — but the
    // error says nothing about what does work.
    const [first] = messages(`@theme { --breakpoint-3xl: 120rem; }`);
    expect(first).toContain('adds the "3xl" breakpoint');
    expect(first).toContain('withPrefix("3xl"');
  });

  it("does not report a removal twice when a reset and a key agree", () => {
    expect(messages(`@theme { --breakpoint-*: initial; --breakpoint-sm: initial; }`)).toHaveLength(
      5,
    );
  });

  it("lets a key survive a reset when it is re-declared at its default", () => {
    const found = messages(`@theme { --breakpoint-*: initial; --breakpoint-sm: 40rem; }`);
    // Four removed; `sm` is back at its default value, so nothing to say about it.
    expect(found).toHaveLength(4);
    expect(found.some((m) => m.includes('"sm"'))).toBe(false);
  });
});

describe("a @custom-variant the keys do not know about", () => {
  // Compiled against Tailwind first: all three spellings register a *static* variant,
  // `midnight-only:underline` gets a rule, and redefining an existing name simply
  // replaces it — the key still resolves and the class still works.
  it("reads every spelling of the at-rule", () => {
    // Names that Tailwind does not already ship — `pointer-coarse` and friends are
    // built in, so a definition of one of those is a redefinition, not a new variant.
    expect(
      customVariantsIn(`@custom-variant midnight-only (@media (prefers-contrast: more));`),
    ).toEqual(["midnight-only"]);
    expect(customVariantsIn(`@custom-variant midnight (&:where([data-theme=x] *));`)).toEqual([
      "midnight",
    ]);
    expect(
      customVariantsIn(`@custom-variant hocus {\n &:hover { @slot; }\n &:focus { @slot; }\n}`),
    ).toEqual(["hocus"]);
  });

  it("says nothing about a name that is already a key", () => {
    // Tailwind replaces the variant; the key still resolves and the class still works,
    // and whether the new meaning is the intended one is not ours to judge.
    expect(customVariantsIn(`@custom-variant hover (&:hover);`)).toEqual([]);
    expect(customVariantsIn(`@custom-variant md (@media (width >= 50rem));`)).toEqual([]);
  });

  it("reports each name once, with the escape hatch that works", () => {
    const [first, ...rest] = themeDiagnostics(
      [],
      customVariantsIn(`@custom-variant midnight-only (@media (prefers-contrast: more));`),
    ).map((d) => d.message);
    expect(rest).toEqual([]);
    expect(first).toContain('defines the "midnight-only" variant');
    expect(first).toContain('withPrefix("midnight-only"');
  });

  it("does not repeat a name declared twice", () => {
    expect(customVariantsIn(`@custom-variant a (&:hover);\n@custom-variant a (&:focus);`)).toEqual([
      "a",
    ]);
  });

  it("ignores a commented-out or quoted definition", () => {
    expect(customVariantsIn(`/* @custom-variant ghost (&:hover); */`)).toEqual([]);
    expect(customVariantsIn(`.a::after { content: "@custom-variant ghost (&:hover);" }`)).toEqual(
      [],
    );
  });

  it("goes quiet when a @config could be adding variants of its own", () => {
    expect(
      customVariantsIn(`@config "./tailwind.config.js";\n@custom-variant ghost (&:hover);`),
    ).toEqual([]);
  });
});

describe("following the stylesheets a theme is split across", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(join(process.cwd(), "node_modules", ".tailess-theme-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads a @theme out of a relatively imported file", async () => {
    // Splitting the theme into its own file and importing it is ordinary, so the
    // answer has to follow it there — the same traversal `isTailwindEntry` does.
    await writeFile(join(dir, "theme.css"), `@theme { --breakpoint-3xl: 120rem; }`);
    const found = await collectBreakpoints(
      `@import "tailwindcss";\n@import "./theme.css";`,
      join(dir, "app.css"),
    );
    expect(themeDiagnostics(found)).toHaveLength(1);
  });

  it("keeps the importing file's own value, as CSS order implies", async () => {
    // `@import` has to precede every other rule, so the importing file's text is
    // always the later one.
    await writeFile(join(dir, "base.css"), `@theme { --breakpoint-md: 10rem; }`);
    const found = await collectBreakpoints(
      `@import "./base.css";\n@theme { --breakpoint-md: 50rem; }`,
      join(dir, "app.css"),
    );
    expect(themeDiagnostics(found)[0]?.message).toContain('sets "md" to 50rem');
  });

  it("lets a later import win over an earlier one", async () => {
    // CSS inlines an @import where it stands, so the last one to declare a name is
    // the one that counts. Reading them first-wins made a later import that restores
    // a default look like drift.
    await writeFile(join(dir, "a.css"), `@theme { --breakpoint-md: 10rem; }`);
    await writeFile(join(dir, "b.css"), `@theme { --breakpoint-md: 48rem; }`);
    const found = await collectBreakpoints(
      `@import "./a.css";\n@import "./b.css";`,
      join(dir, "app.css"),
    );
    expect(themeDiagnostics(found)).toEqual([]);
  });

  it("survives an import that does not resolve", async () => {
    const found = await collectBreakpoints(
      `@import "./missing.css";\n@theme { --breakpoint-3xl: 120rem; }`,
      join(dir, "app.css"),
    );
    expect(themeDiagnostics(found)).toHaveLength(1);
  });

  it("does not follow a commented-out import", async () => {
    await writeFile(join(dir, "old.css"), `@theme { --breakpoint-3xl: 120rem; }`);
    const found = await collectBreakpoints(
      `/* @import "./old.css"; */\n@theme { --breakpoint-md: 48rem; }`,
      join(dir, "app.css"),
    );
    expect(themeDiagnostics(found)).toEqual([]);
  });

  it("goes quiet when a @config turns up in an imported file", async () => {
    // The screens it sets would apply to every stylesheet in the chain, not just its
    // own, so one anywhere silences the whole answer.
    await writeFile(join(dir, "legacy.css"), `@config "../tailwind.config.js";`);
    const found = await collectBreakpoints(
      `@import "./legacy.css";\n@theme { --breakpoint-sm: initial; }`,
      join(dir, "app.css"),
    );
    expect(found).toEqual([]);
  });

  it("finds a @custom-variant in an imported file", async () => {
    await writeFile(
      join(dir, "variants.css"),
      `@custom-variant midnight-only (@media (pointer: coarse));`,
    );
    const theme = await collectTheme(
      `@import "tailwindcss";
@import "./variants.css";`,
      join(dir, "app.css"),
    );
    expect(theme.variants).toEqual(["midnight-only"]);
  });

  it("does not follow a bare specifier, which needs a resolver we do not have", async () => {
    const found = await collectBreakpoints(`@import "@acme/styles";`, join(dir, "app.css"));
    expect(found).toEqual([]);
  });
});

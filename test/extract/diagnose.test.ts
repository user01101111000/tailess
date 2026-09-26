import { describe, expect, it } from "vitest";
import { diagnose } from "../../src/extract/diagnose.js";

/**
 * These run on every file in a consumer's project, on every build. A false positive
 * is therefore worse than a missed one: a warning that fires on working code teaches
 * people to stop reading warnings, and the runtime's own warnings — the ones that
 * catch a genuinely broken class — go with it.
 *
 * So the silent half of this suite matters more than the loud half.
 */

/**
 * The import line each of these snippets stands in for.
 *
 * The checks only speak about a file that imports the helpers: `on`, `data`, `group`,
 * `has`, `inside` and `between` are ordinary identifiers, so without this a file that has
 * never heard of the package would be told one of its classes is unstyled.
 */
const importsThem = `import { ss, cn, on, until, between, data, aria, withPrefix, supports, notSupports, group, peer, container, has, notHas, inside, nth, nthLast, nthOfType, nthLastOfType, responsive, match, variants } from "tailess";\n`;

/** Diagnose `code` as the body of a file that imports the helpers. */
const diag = (code: string, file?: string) => diagnose(importsThem + code, file);

const kinds = (code: string): string[] => diag(code).map((d) => d.kind);

describe("a class the merge always discards", () => {
  it("reports two conflicting utilities in one string", () => {
    expect(kinds(`ss({ base: "p-4 p-2" })`)).toEqual(["dead-class"]);
    expect(kinds(`ss({ md: "text-sm text-lg" })`)).toEqual(["dead-class"]);
    expect(kinds(`until("md", "flex block")`)).toEqual(["dead-class"]);
  });

  it("names the class that never arrives", () => {
    const [first] = diag(`ss({ base: "p-4 p-2" })`);
    expect(first?.message).toContain('"p-4" never reaches the element');
    expect(first?.message).toContain('"p-2" replaces it');
  });

  it("finds a conflict that is not adjacent", () => {
    // `flex` and `block` conflict with `p-4` sitting between them, which is exactly
    // the shape a reader skims past.
    expect(kinds(`ss({ base: "flex p-4 block" })`)).toEqual(["dead-class"]);
  });

  it("says nothing when a later argument overrides — that is the documented way", () => {
    expect(kinds(`ss({ base: "p-4" }, className)`)).toEqual([]);
    expect(kinds(`ss({ base: "p-4" }, { base: "p-2" })`)).toEqual([]);
    expect(kinds(`ss({ base: "p-4" }, "p-2")`)).toEqual([]);
  });

  it("says nothing when a condition makes both reachable", () => {
    // With `cond` false the first one applies, so neither is dead.
    expect(kinds(`ss({ md: ["p-4", cond && "p-2"] })`)).toEqual([]);
    expect(kinds(`ss({ md: cond ? "p-4" : "p-2" })`)).toEqual([]);
  });

  it("says nothing when the value is not statically known", () => {
    // Deliberately a plain string: the point is that the scanner sees an
    // interpolated template in the source and declines to guess at it.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is the fixture
    expect(kinds("ss({ base: `p-4 ${extra}` })")).toEqual([]);
    expect(kinds(`ss({ base: spacing })`)).toEqual([]);
  });

  it("says nothing about utilities that do not conflict", () => {
    expect(kinds(`ss({ base: "flex items-center p-4 text-sm" })`)).toEqual([]);
    expect(kinds(`ss({ base: "p-4", md: "p-2" })`)).toEqual([]);
    expect(kinds(`ss({ base: "px-4 py-2" })`)).toEqual([]);
  });
});

describe("a range no viewport can satisfy", () => {
  it("reports a reversed or empty range", () => {
    expect(kinds(`between("lg", "sm", "block")`)).toEqual(["empty-range"]);
    expect(kinds(`between("md", "md", "block")`)).toEqual(["empty-range"]);
    expect(kinds(`between("2xl", "xl", "block")`)).toEqual(["empty-range"]);
  });

  it("suggests the order that would have worked", () => {
    expect(diag(`between("lg", "sm", "block")`)[0]?.message).toContain('between("sm", "lg", …)');
  });

  it("says nothing about a range that works", () => {
    expect(kinds(`between("sm", "lg", "block")`)).toEqual([]);
    expect(kinds(`between("sm", "2xl", "block")`)).toEqual([]);
  });

  it("says nothing when the breakpoints are not literals", () => {
    expect(kinds(`between(from, to, "block")`)).toEqual([]);
  });
});

describe("a prefix that cannot form a class name", () => {
  it("reports an empty prefix", () => {
    expect(kinds(`withPrefix("", "p-4")`)).toEqual(["blank-prefix"]);
  });

  it("reports whitespace in a prefix", () => {
    expect(kinds(`withPrefix("has-[data-x=a b]", "p-4")`)).toEqual(["spaced-prefix"]);
    expect(diag(`withPrefix("has-[data-x=a b]", "p-4")`)[0]?.message).toContain("has-[data-x=a_b]");
  });

  it("reports whitespace inside a data() variant", () => {
    expect(kinds(`data("state", "half open", "p-2")`)).toEqual(["spaced-prefix"]);
    expect(diag(`data("state", "half open", "p-2")`)[0]?.message).toContain("half_open");
  });

  it("reports an empty entry in an on() array", () => {
    expect(kinds(`on(["dark", ""], "p-2")`)).toEqual(["blank-prefix"]);
  });

  it("says nothing about the spellings that work", () => {
    expect(kinds(`data("state", "half_open", "p-2")`)).toEqual([]);
    expect(kinds(`withPrefix("has-[:checked]", "p-4")`)).toEqual([]);
    expect(kinds(`withPrefix("supports-[display:grid]", "grid")`)).toEqual([]);
    expect(kinds(`on(["dark", "hover"], "p-2")`)).toEqual([]);
  });
});

describe("reporting", () => {
  it("reports one problem once, however often the file repeats it", () => {
    const twice = `ss({ base: "p-4 p-2" });\nss({ base: "p-4 p-2" });`;
    expect(kinds(twice)).toEqual(["dead-class"]);
  });

  it("reports each distinct problem in a file", () => {
    const code = `between("lg", "sm", "a");\nss({ base: "p-4 p-2" });\nwithPrefix("", "b");`;
    expect(kinds(code).sort()).toEqual(["blank-prefix", "dead-class", "empty-range"]);
  });

  it("says nothing about a file with no tailess in it", () => {
    expect(kinds(`const a = "p-4 p-2";\nexport default a;`)).toEqual([]);
  });

  it("survives whatever bytes a scanned file happens to hold", () => {
    for (const code of ["", "```", `ss({ base: "p-4`, "\0�", "ss(".repeat(500)]) {
      expect(() => diagnose(code)).not.toThrow();
    }
  });
});

/**
 * Every one of these was a build failing on code that works. `on`, `data`, `group`,
 * `has`, `inside`, `between` and `responsive` are among the most common identifiers in
 * a JavaScript codebase, and enumeration deliberately matches them on any receiver and
 * inside any string — which is right for candidates and wrong for warnings.
 */
describe("code that has nothing to do with tailess", () => {
  it("says nothing about a file that never imports it", () => {
    const presence = `import { useEffect, useState } from "react";
import { socket } from "./socket";
export function Presence() {
  const [ui, setUi] = useState({ open: false, dark: false });
  useEffect(() => {
    socket.on("presence", ({ open, dark }) => setUi({ open, dark }));
  }, []);
  return <span>{ui.open ? "y" : "n"}</span>;
}`;
    expect(diagnose(presence, "src/Presence.tsx")).toEqual([]);

    for (const code of [
      `emitter.on("change", { first: true, last: false })`,
      `form.on("submit", { disabled: isSubmitting })`,
      `sel.data(rows, "key", { active: true })`,
      `group(source, "key", { first: true })`,
      `inside(point, { first: a, last: b })`,
      `between(lo, hi, { base: 1 })`,
    ]) {
      expect(diagnose(code, "src/app.ts")).toEqual([]);
    }
  });

  it("says nothing about a method call on something that is not tailess", () => {
    // The file does import the package, which is the harder case: enumeration still
    // reads `socket.on` as a call, and only the reporting has to know better.
    expect(kinds(`socket.on("presence", { base: "x", md: "y" })`)).toEqual([]);
    expect(kinds(`emitter.on("change", { first: true, last: false })`)).toEqual([]);
  });

  it("says nothing about a call through an expression, which reads as bare otherwise", () => {
    // `$(x).on(…)` has no identifier before its dot, so it was taken for a bare `on`: a
    // jQuery toggle in a file importing `ss` was told "hidden" never reaches the element.
    expect(kinds(`$("#menu").on("click", () => $("#nav").toggleClass("hidden flex"))`)).toEqual([]);
    expect(kinds(`getSocket().on("presence", { base: "x", md: "y" })`)).toEqual([]);
    expect(kinds(`items[0].on("hover", { base: "underline" })`)).toEqual([]);
  });

  it("says nothing about a bare call to a helper the file imported from elsewhere", () => {
    // Solid's `on` beside tailess's `ss`: the file imports the package, so every bare
    // `on(…)` was checked as ours, and the accessor's `{ open, active }` became a bucket
    // map given class names.
    const solid = `import { createMemo, on } from "solid-js";
import { ss } from "tailess";
const state = createMemo(on(() => props.count, (c) => ({ open: c > 0, active: c > 5 })));
export const cls = ss({ md: "p-4" });`;
    expect(diagnose(solid, "src/Counter.tsx")).toEqual([]);
    // Named in the import, it is ours again.
    const ours = `import { ss, on } from "tailess";\non("hover", { base: "underline" });`;
    expect(diagnose(ours, "src/a.ts").map((d) => d.kind)).toEqual(["bucket-as-dictionary"]);
    const required = `const { on } = require("tailess");\non("hover", { base: "underline" });`;
    expect(diagnose(required, "src/a.cjs").map((d) => d.kind)).toEqual(["bucket-as-dictionary"]);
  });

  it("reads an inline lookup as its values, not as a bucket map", () => {
    // `{ … }[tone]` picks one value at runtime. Taking it for a map named its keys as
    // variants — `primary:bg-blue-600` — and warned that on() was given a dictionary.
    expect(kinds(`on("hover", { sm: "underline", lg: "font-bold" }[size])`)).toEqual([]);
  });

  it("still reports a call through a namespace import, which really is ours", () => {
    const code = `import * as tl from "tailess";\ntl.on("hover", { base: "underline" });`;
    expect(diagnose(code, "src/app.ts").map((d) => d.kind)).toEqual(["bucket-as-dictionary"]);
  });

  it("does not read a destructuring parameter as a clsx dictionary", () => {
    // `({ base, md }) => …` is a pattern, not an object handed to a helper.
    expect(kinds(`on("hover", ({ base, md }) => render(base, md))`)).toEqual([]);
    expect(kinds(`until("md", (({ base }) => base))`)).toEqual([]);
  });
});

describe("a feature query the build cannot enumerate", () => {
  it("reports a query holding a character no class name can carry", () => {
    // The candidate list is written into a stylesheet, so these are dropped there
    // while the runtime still puts the class on the element.
    expect(kinds(`supports("display: grid;", "grid")`)).toEqual(["unusable-query"]);
    expect(kinds(`supports('(content: "it\\'s")', "italic")`)).toEqual(["unusable-query"]);
    expect(kinds(`notSupports("display: grid;", "flex")`)).toEqual(["unusable-query"]);
  });

  it("says nothing about a double-quoted string, which the build carries", () => {
    // Reported, this failed `--strict` over working code: the class goes into a
    // single-quoted `@source inline`, and Tailwind generates its rule.
    expect(kinds(`supports('(font-family: "My Font")', "italic")`)).toEqual([]);
    expect(kinds(`has('input[type="text"]', "p-4")`)).toEqual([]);
  });

  it("reports an empty query", () => {
    expect(kinds(`supports("", "grid")`)).toEqual(["unusable-query"]);
    expect(kinds(`supports("   ", "grid")`)).toEqual(["unusable-query"]);
  });

  it("names the helper and the query", () => {
    const [first] = diag(`notSupports("display: grid;", "flex")`);
    expect(first?.message).toContain("notSupports(");
    expect(first?.message).toContain("display: grid;");
  });

  it("still reports a dead class in the same call", () => {
    expect(kinds(`supports("display:grid", "flex grid")`)).toEqual(["dead-class"]);
  });

  it("reports an unclosed quote, which would be dropped from the candidate list", () => {
    expect(kinds(`supports("content: 'x", "italic")`)).toEqual(["unusable-query"]);
  });

  it("says nothing about a query whose quotes do close", () => {
    expect(kinds(`supports("content: 'x'", "italic")`)).toEqual([]);
  });

  it("says nothing about an ordinary query", () => {
    expect(kinds(`supports("display: grid", "grid")`)).toEqual([]);
    expect(kinds(`supports("(display:grid) and (gap:1rem)", "grid")`)).toEqual([]);
    expect(kinds(`notSupports("backdrop-filter: blur(1px)", "bg-white")`)).toEqual([]);
    expect(kinds(`supports("selector(&>*)", "p-5")`)).toEqual([]);
  });

  it("runs the same check for every helper that writes an arbitrary value", () => {
    // The one failure `tailess check` cannot catch either: the candidate is dropped
    // before it ever reaches the compiler, so nothing downstream can find it missing.
    // Only `supports` used to say so, which left seven helpers with no build check.
    expect(kinds(`has('input[type="text]', "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`notHas("[title='x]", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`inside("", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nth("3n{1}", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nthLast("", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nthOfType('"2n"', "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nthLastOfType("2n;", "p-4")`)).toEqual(["unusable-query"]);
  });

  it("names what each helper calls its value", () => {
    expect(diag(`has("", "p-4")`)[0]?.message).toContain("empty selector");
    expect(diag(`nth("", "p-4")`)[0]?.message).toContain("empty position");
  });

  it("says nothing about ordinary selectors and positions", () => {
    expect(kinds(`has("> img", "p-0")`)).toEqual([]);
    expect(kinds(`has("[title='x']", "p-4")`)).toEqual([]);
    expect(kinds(`inside(".prose", "text-balance")`)).toEqual([]);
    expect(kinds(`nth(3, "p-4")`)).toEqual([]);
    expect(kinds(`nth("3n+1", "p-4")`)).toEqual([]);
  });

  it("reads the class argument of the named variants too", () => {
    expect(kinds(`group("row", "hover", "flex grid")`)).toEqual(["dead-class"]);
    expect(kinds(`peer("email", "invalid", "p-2 p-4")`)).toEqual(["dead-class"]);
    expect(kinds(`container("main", "@md", "hidden block")`)).toEqual(["dead-class"]);
    expect(kinds(`has("> img", "p-2 p-4")`)).toEqual(["dead-class"]);
  });
});

describe("output stays readable", () => {
  it("caps a file that is nothing but conflicts, and says how many were left out", () => {
    // A generated file can hold one string with thousands of conflicting utilities.
    // Naming each would bury the build output and every other file's findings with it.
    const many = Array.from({ length: 5000 }, (_, i) => `p-${i}`).join(" ");
    const found = diag(`ss({ base: "${many}" })`);
    expect(found.length).toBe(21);
    expect(found.at(-1)?.message).toMatch(/^and \d+ more problems in this file/);
  });

  it("does not cap a file with an ordinary number of problems", () => {
    const code = `between("lg", "sm", "a");\nss({ base: "p-4 p-2" });`;
    const found = diag(code);
    expect(found).toHaveLength(2);
    expect(found.some((d) => d.message.startsWith("and "))).toBe(false);
  });
});

describe("a helper imported under another name", () => {
  it("reports it, because the scanner finds calls by identifier", () => {
    // One line that removes every class in the file from the candidate list, while the
    // file compiles, type-checks and renders the right class attribute.
    const [first, ...rest] = diag(`import { ss as tw } from "tailess";\ntw({ md: "p-4" });`);
    expect(rest).toEqual([]);
    expect(first?.kind).toBe("renamed-import");
    expect(first?.message).toContain("ss()");
    expect(first?.message).toContain('"tw"');
  });

  it("reports each renamed helper in a multi-specifier import", () => {
    const kinds = diag(`import { cn, ss as tw, on as when, has } from "tailess";`).map(
      (d) => d.kind,
    );
    expect(kinds).toEqual(["renamed-import", "renamed-import"]);
  });

  it("says nothing about an import that keeps the names", () => {
    expect(kinds(`import { ss, cn, variants } from "tailess";\nss({ md: "p-4" });`)).toEqual([]);
    expect(kinds(`import ss from "tailess";`)).toEqual([]);
    expect(kinds(`import * as tailess from "tailess";`)).toEqual([]);
  });

  it("says nothing about a rename that is not a scanned helper", () => {
    // `cn` and `match` build no variant prefix, so the scanner never looks for them
    // and renaming one costs nothing.
    expect(kinds(`import { cn as clsx, match as pick } from "tailess";`)).toEqual([]);
    expect(kinds(`import { screens as bp, vars as style } from "tailess";`)).toEqual([]);
  });

  it("says nothing about a rename from some other package", () => {
    expect(kinds(`import { ss as tw } from "other-lib";`)).toEqual([]);
    expect(kinds(`import { ss as tw } from "tailess/vite";`)).toEqual([]);
  });

  it("reports the spellings a line-start import pattern missed", () => {
    // Each of these renames a helper and unstyles every class it builds; none was seen.
    const cases: [string, string][] = [
      [`export { ss as tw } from "tailess";`, "re-exported"],
      [`const { ss: tw } = require("tailess");`, "required"],
      [`"use client"; import { ss as tw } from "tailess";`, "imported"],
      [`import{ss as t}from"tailess";`, "imported"],
    ];
    for (const [code, verb] of cases) {
      const found = diagnose(code, "src/a.ts");
      expect(
        found.map((d) => d.kind),
        code,
      ).toEqual(["renamed-import"]);
      expect(found[0]?.message).toContain(`is ${verb} as`);
    }
    // A re-export takes its classes from every file that imports it, not this one.
    expect(diagnose(`export { on as when } from "tailess";`)[0]?.message).toContain(
      "in every file that imports it from here",
    );
  });

  it("says nothing about a type-only rename, which binds nothing callable", () => {
    expect(diagnose(`import type { ss as tw } from "tailess";`)).toEqual([]);
    expect(diagnose(`import { type ss as tw, cn } from "tailess";`)).toEqual([]);
    expect(diagnose(`const s = 'x; import { ss as tw } from "tailess"';`)).toEqual([]);
  });
});

describe("files that reach tailess other than through a named import", () => {
  it("checks a CommonJS namespace and a dynamic import like any other", () => {
    // The checks were silently off in each: only `import * as` counted as a receiver,
    // and `import("tailess")` did not count as importing the package at all.
    for (const code of [
      `const t = require("tailess");\nt.ss({ md: size });`,
      `const t = await import("tailess");\nt.ss({ md: size });`,
      `const { ss } = await import("tailess");\nss({ md: size });`,
    ]) {
      expect(
        diagnose(code, "src/a.ts").map((d) => d.kind),
        code,
      ).toEqual(["dynamic-value"]);
    }
  });
});

describe("where an import statement is prose rather than code", () => {
  it("says nothing about a renamed import inside Markdown or HTML", () => {
    // The scanner reads Markdown because a class can appear in one, but the imports
    // there are examples — a README documenting the anti-pattern would otherwise be
    // reported for committing it, which is a warning fired at working docs.
    const code = `Do not do this:\n\n\`\`\`ts\nimport { ss as tw } from "tailess";\n\`\`\``;
    expect(diagnose(code, "docs/guide.md")).toEqual([]);
    expect(diagnose(code, "README.markdown")).toEqual([]);
    expect(diagnose(code, "page.html")).toEqual([]);
  });

  it("says nothing about an import that is commented out or quoted", () => {
    // A commented-out line is the everyday shape, and this check asserts the strongest
    // failure the package reports — in the same output that says every class has CSS.
    const commented = `import { ss, cn } from "tailess";
// import { ss as tw } from "tailess";
export const cls = ss({ base: "flex", md: "p-6" });`;
    expect(diagnose(commented, "src/Card.tsx")).toEqual([]);

    const quoted = `import { ss } from "tailess";
const sample = \`import { ss as tw } from "tailess";\`;
export const cls = ss({ base: "flex" });`;
    expect(diagnose(quoted, "src/Docs.tsx")).toEqual([]);

    const inString = `import { ss } from "tailess";
const sample = 'import { ss as tw } from "tailess";';
export const cls = ss({ base: "flex" });`;
    expect(diagnose(inString, "src/Docs.tsx")).toEqual([]);
  });

  it("still reports it in a file whose imports run", () => {
    const code = `import { ss as tw } from "tailess";`;
    expect(diagnose(code, "src/App.tsx").map((d) => d.kind)).toEqual(["renamed-import"]);
    // `.mdx` imports really do run, so it is deliberately not treated as prose.
    expect(diagnose(code, "docs/page.mdx").map((d) => d.kind)).toEqual(["renamed-import"]);
    // No path in hand means no reason to assume prose.
    expect(diagnose(code).map((d) => d.kind)).toEqual(["renamed-import"]);
  });

  it("still reports everything else in a Markdown file that imports the helpers", () => {
    // Only the import check is gated by the extension; a class written in a fence whose
    // sample imports tailess is still a class.
    expect(diag(`ss({ base: "p-4 p-2" })`, "docs/guide.md").map((d) => d.kind)).toEqual([
      "dead-class",
    ]);
    // Without that import there is nothing saying the call is ours, so it stays quiet.
    expect(diagnose(`ss({ base: "p-4 p-2" })`, "docs/guide.md")).toEqual([]);
  });
});

describe("an ss map handed to a helper that takes a flat class value", () => {
  it("reports it, because the keys become the class names", () => {
    // Composition runs one way: a helper nests *inside* an `ss` bucket. The other way
    // round, the object is a clsx dictionary and `on("hover", { base: "underline" })`
    // builds "hover:base" — silently, and only where a cast let it past the types.
    const [first] = diag(`on("hover", { base: "underline", md: "font-bold" })`);
    expect(first?.kind).toBe("bucket-as-dictionary");
    expect(first?.message).toContain("ss({ base: on(…) })");
    expect(kinds(`until("md", { base: "hidden" })`)).toEqual(["bucket-as-dictionary"]);
    expect(kinds(`supports("display:grid", { base: "grid" })`)).toEqual(["bucket-as-dictionary"]);
    expect(kinds(`group("row", "hover", { md: "underline" })`)).toEqual(["bucket-as-dictionary"]);
    expect(kinds(`has("> img", { hover: "p-0" })`)).toEqual(["bucket-as-dictionary"]);
  });

  it("reports one inside responsive()'s breakpoints and match()'s options too", () => {
    // Nothing else catches these two: `responsive("p-2", { md: { hover: "p-4" } })`
    // builds `md:hover`, `match(size, { sm: { md: "p-4" } })` builds `md`, and neither
    // utility exists — so `check` skips them as junk, and the element ships unstyled.
    const [fromResponsive] = diag(`responsive("p-2", { md: { hover: "p-4" } })`);
    expect(fromResponsive?.kind).toBe("bucket-as-dictionary");
    expect(fromResponsive?.message).toContain('ss({ md: { hover: "…" } })');
    const [fromMatch] = diag(`match(size, { sm: { md: "p-4" }, lg: "p-8" })`);
    expect(fromMatch?.kind).toBe("bucket-as-dictionary");
    expect(fromMatch?.message).toContain("ss(");
    // A real clsx dictionary there is fine.
    expect(kinds(`responsive("p-2", { md: { hidden: !open } })`)).toEqual([]);
    expect(kinds(`match(size, { sm: { "p-2": dense }, lg: "p-8" })`)).toEqual([]);
  });

  it("says nothing about the composition that is correct", () => {
    expect(kinds(`ss({ md: on("hover", "underline") })`)).toEqual([]);
    expect(kinds(`ss({ base: "p-4", md: "p-6" })`)).toEqual([]);
    expect(kinds(`responsive("p-4", { md: "p-6" })`)).toEqual([]);
  });

  it("says nothing about a real clsx dictionary, which is the documented shape", () => {
    expect(kinds(`until("md", { hidden: !open })`)).toEqual([]);
    expect(kinds(`on("hover", { "sr-only": cond, underline: isActive })`)).toEqual([]);
    expect(kinds(`on("hover", { block: a, flex: b })`)).toEqual([]);
  });
});

describe("when a bucket key is also a plausible class name", () => {
  it("names both readings, since only one of them has the suggested rewrite as its fix", () => {
    // `.active` in Bootstrap, `.open` in a CSS module: `{ first: i === 0 }` is an
    // ordinary clsx dictionary, and there the class is dead for a different reason than
    // the message asserted — and the rewrite it suggested builds something else entirely.
    const [first] = diag(`until("md", cn(styles.row, { first: i === 0, last: i === n - 1 }))`);
    expect(first?.kind).toBe("bucket-as-dictionary");
    expect(first?.message).toContain("ss({ first: until(…) })");
    expect(first?.message).toContain('If "first" really is your own class name');
  });

  it("says nothing extra for a key nobody would name a class", () => {
    // Nobody writes a class called `base`, `2xl` or `group-hover`, so there is only one
    // reading and a second sentence would be noise on every report.
    for (const code of [
      `on("hover", { base: "underline", md: "font-bold" })`,
      `until("md", { "2xl": "hidden" })`,
      `on("hover", { "group-hover": "underline" })`,
    ]) {
      const [found] = diag(code);
      expect(found?.kind).toBe("bucket-as-dictionary");
      expect(found?.message).not.toContain("really is your own class name");
    }
  });
});

describe("a bucket the scanner cannot read", () => {
  it("reports the shapes the README lists as invisible", () => {
    // The package's most common support case, and the type system cannot express any
    // of it: `ss({ md: size })` is perfectly well typed and completely unstyled.
    expect(kinds(`ss({ md: size })`)).toEqual(["dynamic-value"]);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is the fixture
    expect(kinds("ss({ md: `text-${scale}` })")).toEqual(["dynamic-value"]);
    expect(kinds(`ss({ hover: props.className })`)).toEqual(["dynamic-value"]);
    expect(kinds(`responsive("p-4", { md: size })`)).toEqual(["dynamic-value"]);
  });

  it("reports one nested under another prefix, and a base under a prefix", () => {
    // A value that was itself a map was skipped outright, so the stacked bucket inside
    // it was never looked at — `dark:md:<size>` shipped with no rule and no word.
    expect(kinds(`ss({ dark: { md: size } })`)).toEqual(["dynamic-value"]);
    expect(kinds(`ss({ md: { base: size } })`)).toEqual(["dynamic-value"]);
    expect(kinds(`ss({ base: { md: size } })`)).toEqual(["dynamic-value"]);
  });

  it("reports one inside a recipe, wherever the recipe keeps its classes", () => {
    // The recipe helper had no case at all, so every one of these was silent.
    for (const code of [
      `variants({ variants: { s: { lg: { md: size } } } })`,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is the fixture
      "variants({ variants: { s: { lg: { md: `p-${n}` } } } })",
      `variants({ base: { md: size }, variants: {} })`,
      `variants({ variants: { s: { a: "p-1" } }, compound: [{ s: "a", class: { md: size } }] })`,
      `variants({ slots: { root: { md: size } }, variants: {} })`,
      `variants({ slots: { root: "p-1" }, variants: { s: { a: { root: { md: size } } } } })`,
      `variants({ md: size }, { variants: { s: { a: "p-1" } } })`,
    ]) {
      expect(kinds(code), code).toEqual(["dynamic-value"]);
    }
  });

  it("stays quiet about an unprefixed value in a recipe, which Tailwind finds itself", () => {
    // The same rule as `base` in ss: no prefix, nothing for the scanner to add.
    for (const code of [
      `variants({ base: size, variants: { s: { a: tone } } })`,
      `variants({ slots: { root: size }, variants: { s: { a: { root: tone } } } })`,
      `variants({ variants: { s: { a: "p-1" } }, compound: [{ s: "a", class: extra }] })`,
      `variants({ slots: { root: "p-1" }, variants: {}, compound: [{ class: { root: extra } }] })`,
      `variants(size, { variants: { s: { a: "p-1" } } })`,
    ]) {
      expect(kinds(code), code).toEqual([]);
    }
  });

  it("names the value and the way out", () => {
    const [first] = diag(`ss({ md: size })`);
    expect(first?.message).toContain('"md" bucket is set to `size`');
    expect(first?.message).toContain("match(size, { … })");
    expect(first?.message).toContain("vars()");
  });

  it("says nothing about base, where the value passes through unprefixed", () => {
    // Tailwind finds the literal wherever it really lives, so the same shape works —
    // and reporting it would be a warning fired at code that is fine.
    expect(kinds(`ss({ base: size })`)).toEqual([]);
    expect(kinds(`ss({ base: props.className })`)).toEqual([]);
  });

  it("says nothing when every part that becomes a class is a literal", () => {
    expect(kinds(`ss({ md: cond && "p-4" })`)).toEqual([]);
    expect(kinds(`ss({ md: a && b && "p-4" })`)).toEqual([]);
    expect(kinds(`ss({ md: cond ? "p-4" : "p-2" })`)).toEqual([]);
    expect(kinds(`ss({ md: cond ? "p-4" : undefined })`)).toEqual([]);
    expect(kinds(`ss({ md: a ? "p-1" : b ? "p-2" : "p-3" })`)).toEqual([]);
    expect(kinds(`ss({ md: [cond && "p-4", "flex"] })`)).toEqual([]);
    expect(kinds(`ss({ md: [{ "p-4": open }, "flex"] })`)).toEqual([]);
    expect(kinds(`ss({ md: (cond ? "p-4" : "p-2") })`)).toEqual([]);
    expect(kinds(`ss({ md: user?.admin ? "p-4" : "p-2" })`)).toEqual([]);
    expect(kinds(`ss({ md: { hover: "underline" } })`)).toEqual([]);
    expect(kinds(`ss({ md: on("hover", "underline") })`)).toEqual([]);
    expect(kinds(`ss({ base: "p-1", md: "p-2" })`)).toEqual([]);
  });

  it("reports the part that is not a literal, even beside one that is", () => {
    // A literal anywhere in the value vouched for all of it, so each of these built a
    // class nothing enumerated — `md:<size>` — and said nothing. `[x, "p-4"]` was in the
    // quiet list above until the audit that found this: `md:<x>` has no rule either.
    for (const code of [
      `ss({ md: cond ? size : "p-2" })`,
      `ss({ md: [size, "flex"] })`,
      `ss({ md: [x, "p-4"] })`,
      `ss({ md: size ?? "p-2" })`,
      `ss({ md: size || "p-2" })`,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is the fixture
      'ss({ md: [`text-${scale}`, "font-bold"] })',
      `ss({ md: ["p-4", button({ tone })] })`,
      `ss({ base: "p-1", md })`,
      `ss({ md: { base: "p-1", hover } })`,
    ]) {
      expect(kinds(code), code).toEqual(["dynamic-value"]);
    }
    const [first] = diag(`ss({ md: cond ? size : "p-2" })`);
    expect(first?.message).toContain(
      '"md" bucket is set to `cond ? size : "p-2"`, and `size` in it',
    );
    expect(first?.message).toContain("match(size, { … })");
  });

  it("says nothing about a value that contributes no class at all", () => {
    for (const value of ["true", "false", "null", "undefined", "0"]) {
      expect(kinds(`ss({ md: ${value} })`)).toEqual([]);
    }
  });

  it("says nothing about a TypeScript object type, which is not a bucket map", () => {
    // Every class here is enumerated and has CSS; the `string` the warning quoted is a type.
    expect(kinds(`ss({ md: cond ? "p-4" : "p-2" } as { md: string })`)).toEqual([]);
    expect(kinds(`ss({ md: "p-4" } satisfies { md: string })`)).toEqual([]);
    expect(kinds(`ss({ md: "m-1" }, ((x: { md: string }) => x.md)(v) && { lg: "p-6" })`)).toEqual(
      [],
    );
    expect(kinds(`ss({ md: void 0 })`)).toEqual([]);
  });

  it("still reads the other branch of a ternary, whose colon is not a type's", () => {
    expect(kinds(`ss(cond ? { md: "p-4" } : { md: size })`)).toEqual(["dynamic-value"]);
    expect(kinds(`ss(a ? b : { md: size })`)).toEqual(["dynamic-value"]);
    expect(kinds(`ss({ base: "p-1", md: { base: size } })`)).toEqual(["dynamic-value"]);
  });

  it("says nothing about a later argument, which is not a bucket", () => {
    expect(kinds(`ss({ md: "p-4" }, className)`)).toEqual([]);
    expect(kinds(`ss(base, cond && { md: "p-4" })`)).toEqual([]);
  });
});

describe("a file saved with a byte order mark", () => {
  it("is checked like any other", () => {
    // Common on Windows. The BOM sat in front of the first-line import, which the
    // import patterns are anchored to, and every check in the file went quiet.
    const bom = "﻿";
    expect(
      diagnose(`${bom}import { ss as tw } from "tailess";\ntw({ md: "p-1" });`).map((d) => d.kind),
    ).toEqual(["renamed-import"]);
    expect(
      diagnose(`${bom}import { between } from "tailess";\nbetween("lg", "sm", "block");`).map(
        (d) => d.kind,
      ),
    ).toEqual(["empty-range"]);
  });
});

describe("a prefixed class the build cannot hand to Tailwind", () => {
  it("names it, since the literal in the source is not the class on the element", () => {
    // `{`, `}` and `\` break @source inline(…), so the scanner drops the class — and the
    // runtime builds `md:after:content-['{']` while Tailwind only ever sees the unprefixed
    // literal. Silent until this.
    const [found] = diag(`ss({ md: "after:content-['{']" })`);
    expect(found?.kind).toBe("uncarried-class");
    expect(found?.message).toContain("md:after:content-['{']");
    // Four backslashes in this template are two in the source, which is one in the value.
    expect(kinds(`on("hover", "before:content-['\\\\']")`)).toEqual(["uncarried-class"]);
    expect(kinds(`on("hover", "after:content-['}']")`)).toEqual(["uncarried-class"]);
  });

  it("stays quiet about the same class unprefixed, and about a brace that is not a class", () => {
    expect(kinds(`ss({ base: "after:content-['{']" })`)).toEqual([]);
    expect(kinds(`ss("after:content-['{']")`)).toEqual([]);
    expect(kinds(`on("hover", fmt("{", x))`)).toEqual([]);
    // And about a double quote, which is carried now.
    expect(kinds(`ss({ md: 'after:content-["x"]' })`)).toEqual([]);
  });
});

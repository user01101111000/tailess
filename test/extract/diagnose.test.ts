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

const kinds = (code: string): string[] => diagnose(code).map((d) => d.kind);

describe("a class the merge always discards", () => {
  it("reports two conflicting utilities in one string", () => {
    expect(kinds(`ss({ base: "p-4 p-2" })`)).toEqual(["dead-class"]);
    expect(kinds(`ss({ md: "text-sm text-lg" })`)).toEqual(["dead-class"]);
    expect(kinds(`until("md", "flex block")`)).toEqual(["dead-class"]);
  });

  it("names the class that never arrives", () => {
    const [first] = diagnose(`ss({ base: "p-4 p-2" })`);
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
    expect(diagnose(`between("lg", "sm", "block")`)[0]?.message).toContain(
      'between("sm", "lg", …)',
    );
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
    expect(diagnose(`withPrefix("has-[data-x=a b]", "p-4")`)[0]?.message).toContain(
      "has-[data-x=a_b]",
    );
  });

  it("reports whitespace inside a data() variant", () => {
    expect(kinds(`data("state", "half open", "p-2")`)).toEqual(["spaced-prefix"]);
    expect(diagnose(`data("state", "half open", "p-2")`)[0]?.message).toContain("half_open");
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

describe("a feature query the build cannot enumerate", () => {
  it("reports a query holding a character no class name can carry", () => {
    // The candidate list is written into a stylesheet, so these are dropped there
    // while the runtime still puts the class on the element.
    expect(kinds(`supports("display: grid;", "grid")`)).toEqual(["unusable-query"]);
    expect(kinds(`supports('(font-family: "My Font")', "italic")`)).toEqual(["unusable-query"]);
    expect(kinds(`notSupports("display: grid;", "flex")`)).toEqual(["unusable-query"]);
  });

  it("reports an empty query", () => {
    expect(kinds(`supports("", "grid")`)).toEqual(["unusable-query"]);
    expect(kinds(`supports("   ", "grid")`)).toEqual(["unusable-query"]);
  });

  it("names the helper and the query", () => {
    const [first] = diagnose(`notSupports("display: grid;", "flex")`);
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
    expect(kinds(`has('input[type="text"]', "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`notHas("[title='x]", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`inside("", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nth("3n{1}", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nthLast("", "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nthOfType('"2n"', "p-4")`)).toEqual(["unusable-query"]);
    expect(kinds(`nthLastOfType("2n;", "p-4")`)).toEqual(["unusable-query"]);
  });

  it("names what each helper calls its value", () => {
    expect(diagnose(`has("", "p-4")`)[0]?.message).toContain("empty selector");
    expect(diagnose(`nth("", "p-4")`)[0]?.message).toContain("empty position");
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
    const found = diagnose(`ss({ base: "${many}" })`);
    expect(found.length).toBe(21);
    expect(found.at(-1)?.message).toMatch(/^and \d+ more problems in this file/);
  });

  it("does not cap a file with an ordinary number of problems", () => {
    const code = `between("lg", "sm", "a");\nss({ base: "p-4 p-2" });`;
    const found = diagnose(code);
    expect(found).toHaveLength(2);
    expect(found.some((d) => d.message.startsWith("and "))).toBe(false);
  });
});

describe("a helper imported under another name", () => {
  it("reports it, because the scanner finds calls by identifier", () => {
    // One line that removes every class in the file from the candidate list, while the
    // file compiles, type-checks and renders the right class attribute.
    const [first, ...rest] = diagnose(`import { ss as tw } from "tailess";\ntw({ md: "p-4" });`);
    expect(rest).toEqual([]);
    expect(first?.kind).toBe("renamed-import");
    expect(first?.message).toContain("ss()");
    expect(first?.message).toContain('"tw"');
  });

  it("reports each renamed helper in a multi-specifier import", () => {
    const kinds = diagnose(`import { cn, ss as tw, on as when, has } from "tailess";`).map(
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

  it("still reports it in a file whose imports run", () => {
    const code = `import { ss as tw } from "tailess";`;
    expect(diagnose(code, "src/App.tsx").map((d) => d.kind)).toEqual(["renamed-import"]);
    // `.mdx` imports really do run, so it is deliberately not treated as prose.
    expect(diagnose(code, "docs/page.mdx").map((d) => d.kind)).toEqual(["renamed-import"]);
    // No path in hand means no reason to assume prose.
    expect(diagnose(code).map((d) => d.kind)).toEqual(["renamed-import"]);
  });

  it("still reports everything else in a Markdown file", () => {
    // Only the import check is gated; a class written in a fenced block is still a class.
    expect(diagnose(`ss({ base: "p-4 p-2" })`, "docs/guide.md").map((d) => d.kind)).toEqual([
      "dead-class",
    ]);
  });
});

describe("an ss map handed to a helper that takes a flat class value", () => {
  it("reports it, because the keys become the class names", () => {
    // Composition runs one way: a helper nests *inside* an `ss` bucket. The other way
    // round, the object is a clsx dictionary and `on("hover", { base: "underline" })`
    // builds "hover:base" — silently, and only where a cast let it past the types.
    const [first] = diagnose(`on("hover", { base: "underline", md: "font-bold" })`);
    expect(first?.kind).toBe("bucket-as-dictionary");
    expect(first?.message).toContain("ss({ base: on(…) })");
    expect(kinds(`until("md", { base: "hidden" })`)).toEqual(["bucket-as-dictionary"]);
    expect(kinds(`supports("display:grid", { base: "grid" })`)).toEqual(["bucket-as-dictionary"]);
    expect(kinds(`group("row", "hover", { md: "underline" })`)).toEqual(["bucket-as-dictionary"]);
    expect(kinds(`has("> img", { hover: "p-0" })`)).toEqual(["bucket-as-dictionary"]);
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

  it("names the value and the way out", () => {
    const [first] = diagnose(`ss({ md: size })`);
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

  it("says nothing when a literal is in reach", () => {
    expect(kinds(`ss({ md: cond && "p-4" })`)).toEqual([]);
    expect(kinds(`ss({ md: cond ? "p-4" : "p-2" })`)).toEqual([]);
    expect(kinds(`ss({ md: [x, "p-4"] })`)).toEqual([]);
    expect(kinds(`ss({ md: { hover: "underline" } })`)).toEqual([]);
    expect(kinds(`ss({ md: on("hover", "underline") })`)).toEqual([]);
  });

  it("says nothing about a value that contributes no class at all", () => {
    for (const value of ["true", "false", "null", "undefined", "0"]) {
      expect(kinds(`ss({ md: ${value} })`)).toEqual([]);
    }
  });

  it("says nothing about a later argument, which is not a bucket", () => {
    expect(kinds(`ss({ md: "p-4" }, className)`)).toEqual([]);
    expect(kinds(`ss(base, cond && { md: "p-4" })`)).toEqual([]);
  });
});

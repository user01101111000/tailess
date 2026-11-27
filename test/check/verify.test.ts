import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";
import {
  type CompiledSheet,
  findBroken,
  probeList,
  splitCandidate,
  utilityList,
} from "../../src/check/verify.js";
import { extractClasses } from "../../src/extract/extract.js";
import { hasRule } from "../../src/internal/selector.js";

/**
 * `tailess check` exists because everything else proves the *bridge* and nothing
 * proved the far end. The plugins guarantee the scanner enumerates what the runtime
 * builds and hands the list to Tailwind; none of that catches a `@theme` that dropped
 * a breakpoint, a `@config` the theme check deliberately says nothing about, or an
 * arbitrary value Tailwind rejects. Compiling for real does.
 *
 * The design turns on one comparison. The scanner over-approximates on purpose, so
 * demanding a rule for every candidate would report a mountain of junk — `md:state`
 * from a `data()` name, `md:calc(100%` from an argument that was never a class. But
 * junk does not resolve bare either, so asking "does the utility work on its own?"
 * first leaves exactly the classes worth reporting.
 */

const require = createRequire(import.meta.url);
const tailwindDir = dirname(require.resolve("tailwindcss/package.json"));
const tailwindIndex = await readFile(join(tailwindDir, "index.css"), "utf8");
const loadStylesheet = async (id: string, base: string) => {
  if (id === "tailwindcss") return { base, path: "index.css", content: tailwindIndex };
  throw new Error(`unexpected stylesheet: ${id}`);
};

/** Compile `entry`, offering `candidates` to the compiler. */
async function build(entry: string, candidates: readonly string[]): Promise<string> {
  const compiler = await compile(entry, { base: process.cwd(), loadStylesheet });
  return compiler.build([...candidates]);
}

/** Compile `entry` the way `tailess check` does: nothing, then bare utilities, then all. */
async function sheet(entry: string, candidates: readonly string[]): Promise<CompiledSheet> {
  const compiler = await compile(entry, { base: process.cwd(), loadStylesheet });
  const baseline = compiler.build([]);
  const utilities = compiler.build(utilityList(candidates));
  const css = compiler.build(probeList(candidates));
  return { css, utilities, baseline };
}

describe("splitting a candidate", () => {
  it("splits at the last top-level colon", () => {
    expect(splitCandidate("md:p-4")).toEqual({ prefix: "md", utility: "p-4" });
    expect(splitCandidate("dark:hover:bg-black")).toEqual({
      prefix: "dark:hover",
      utility: "bg-black",
    });
  });

  it("ignores colons inside brackets, which are not separators", () => {
    // `supports-[display:_grid]` is full of colons that do not split anything.
    expect(splitCandidate("supports-[display:_grid]:grid")).toEqual({
      prefix: "supports-[display:_grid]",
      utility: "grid",
    });
    expect(splitCandidate("md:has-[input[type=text]]:ring-2")).toEqual({
      prefix: "md:has-[input[type=text]]",
      utility: "ring-2",
    });
  });

  it("returns null for a class with no prefix", () => {
    // Unprefixed classes are literal in the source, so Tailwind finds them itself and
    // they are not this package's to vouch for.
    expect(splitCandidate("p-4")).toBeNull();
    expect(splitCandidate("")).toBeNull();
    expect(splitCandidate(":p-4")).toBeNull();
    expect(splitCandidate("md:")).toBeNull();
  });
});

describe("the probe list", () => {
  it("adds each candidate's bare utility, since that is the other question", () => {
    expect(probeList(["md:p-4"]).sort()).toEqual(["md:p-4", "p-4"]);
  });

  it("de-duplicates", () => {
    expect(probeList(["md:p-4", "lg:p-4", "p-4"]).sort()).toEqual(["lg:p-4", "md:p-4", "p-4"]);
  });

  it("lists the bare utilities on their own, once", () => {
    expect(utilityList(["md:p-4", "lg:p-4", "p-4", "dark:hover:bg-black"]).sort()).toEqual([
      "bg-black",
      "p-4",
    ]);
  });
});

describe("which rules count as a utility resolving on its own", () => {
  // Both of these failed a healthy build, with `tailess check` exiting 1 on code the
  // README tells people to write. The junk is the scanner's, on purpose; what changed is
  // which rules are allowed to say a junk word is a utility.

  it("does not let a selector another candidate generated vouch for a word in it", async () => {
    // `withPrefix("group-[.open]", …)` compiles to `…:is(:where(.group):is(.open) *)`, and
    // `data("state", "open", …)` inside an `md` bucket hands the scanner `md:open`.
    const source = `cn(withPrefix("group-[.open]", "rotate-90"), ss({ md: data("state", "open", "flex") }))`;
    const classes = extractClasses(source);
    expect(classes).toContain("md:open");
    const compiled = await sheet(`@import "tailwindcss";`, classes);
    expect(findBroken(classes, compiled)).toEqual([]);
    // Read from the one stylesheet holding every candidate, `.open` looks like a rule.
    expect(findBroken(classes, compiled.css)).toContainEqual({
      candidate: "md:open",
      utility: "open",
    });
  });

  it("does not count a class the stylesheet writes by hand, which no variant reaches", async () => {
    // shadcn/ui's globals.css, trimmed: a class-based dark variant and a `.dark` rule.
    const entry =
      `@import "tailwindcss";\n@custom-variant dark (&:is(.dark *));\n` +
      ":root { --background: white; }\n.dark { --background: black; }";
    const source = `ss({ base: "text-sm", md: on(["dark", "hover"], "underline") })`;
    const classes = extractClasses(source);
    expect(classes).toContain("md:dark");
    const compiled = await sheet(entry, classes);
    expect(findBroken(classes, compiled)).toEqual([]);
    expect(findBroken(classes, compiled.css)).toContainEqual({
      candidate: "md:dark",
      utility: "dark",
    });
  });

  it("still reports a breakpoint the theme removed", async () => {
    const entry = `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }\n.card { padding: 0; }`;
    const classes = ["md:p-4", "lg:p-6", "md:card"];
    expect(findBroken(classes, await sheet(entry, classes))).toEqual([
      { candidate: "md:p-4", utility: "p-4" },
    ]);
  });

  it("still reports a utility of the project's own that a variant cannot reach", async () => {
    // An `@utility` is generated on demand, so it is a utility like any other.
    const entry =
      `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }\n` +
      "@utility brand { color: rebeccapurple; }";
    const classes = ["md:brand"];
    expect(findBroken(classes, await sheet(entry, classes))).toEqual([
      { candidate: "md:brand", utility: "brand" },
    ]);
  });
});

describe("finding classes with no rule behind them", () => {
  it("reports a breakpoint the theme removed", async () => {
    const entry = `@import "tailwindcss";\n@theme { --breakpoint-md: initial; }`;
    const classes = ["md:p-4", "lg:p-6"];
    const found = findBroken(classes, await build(entry, probeList(classes)));
    expect(found).toEqual([{ candidate: "md:p-4", utility: "p-4" }]);
  });

  it("says nothing when every class resolves", async () => {
    const classes = ["md:p-4", "lg:p-6", "dark:hover:bg-black"];
    expect(findBroken(classes, await build(`@import "tailwindcss";`, probeList(classes)))).toEqual(
      [],
    );
  });

  it("ignores the junk the scanner produces on purpose", async () => {
    // Everything here comes out of a real call site: `data()` contributes its name and
    // value, `supports()` its condition split on whitespace. None of it is a class,
    // and none of it resolves bare — which is exactly what keeps it out of the report.
    const source = `ss({ md: data("state", "open", "p-2") })`;
    const classes = extractClasses(source);
    // The sweep reads every string at the call site, so the attribute's name and value
    // arrive as `md:state` and `md:open` beside the class that is real.
    expect(classes).toContain("md:state");
    expect(classes).toContain("md:open");
    expect(findBroken(classes, await build(`@import "tailwindcss";`, probeList(classes)))).toEqual(
      [],
    );
  });

  it("reports a variant the CSS redefined out from under a key", async () => {
    // `@custom-variant` can replace a built-in. Here `dark` is redefined to need a
    // value, so the plain `dark:` spelling stops resolving while `bg-black` still does.
    const entry = `@import "tailwindcss";\n@custom-variant dark (&:where(.x &));`;
    const classes = ["dark:bg-black"];
    const css = await build(entry, probeList(classes));
    // Whatever the redefinition does, the check's verdict must match the CSS.
    const reported = findBroken(classes, css).length > 0;
    expect(reported).toBe(!css.includes("dark\\:bg-black"));
  });

  it("does not report an unprefixed class", async () => {
    expect(findBroken(["p-4"], await build(`@import "tailwindcss";`, ["p-4"]))).toEqual([]);
  });

  it("does not mistake a longer class for the one it was asked about", async () => {
    // `xl` is not a utility, but `.xl\:text-2xl` starts the same way, so a substring
    // search said it resolved and the junk candidate `lg:xl` was reported against a
    // healthy build. Both classes here are real ones from the README's own examples.
    const classes = ["lg:xl", "xl:text-2xl"];
    const css = await build(`@import "tailwindcss";`, probeList(classes));
    expect(findBroken(classes, css)).toEqual([]);
  });
});

describe("asking whether a stylesheet has a rule for a class", () => {
  it("requires the selector to end where the match does", () => {
    // Both directions of the same mistake. Reading a longer class as a shorter one
    // reports a healthy build; reading a shorter one as present hides a broken class,
    // which is the failure this whole package is about.
    expect(hasRule(".xl\\:text-2xl { font-size: 1.5rem }", "xl")).toBe(false);
    expect(hasRule(".md\\:p-40 { padding: 10rem }", "md:p-4")).toBe(false);
    expect(hasRule(".p-40 { padding: 10rem }", "p-4")).toBe(false);
  });

  it("finds the class when it really is there", () => {
    expect(hasRule(".xl\\:text-2xl { font-size: 1.5rem }", "xl:text-2xl")).toBe(true);
    // Whatever follows the selector — a compound selector, a combinator, a comma or
    // the brace — ends the class name.
    expect(hasRule(".p-4.flex { }", "p-4")).toBe(true);
    expect(hasRule(".p-4 > * { }", "p-4")).toBe(true);
    expect(hasRule(".p-40, .p-4 { }", "p-4")).toBe(true);
    expect(hasRule(".p-4:hover { }", "p-4")).toBe(true);
    // A leading digit is a hex escape, trailing space and all.
    expect(hasRule(".\\32 xl\\:flex { }", "2xl:flex")).toBe(true);
  });

  it("finds a class with characters outside ASCII, which Tailwind leaves bare", async () => {
    // Every non-ASCII character was escaped, where Tailwind (and CSS.escape) write it as
    // it is: a German attribute value, a CJK selector, an arrow in `content` all read as
    // missing — failing working code, and letting a broken one pass because its utility
    // "did not resolve" either.
    const classes = [
      "data-[state=geöffnet]:p-3",
      "has-[[lang='日本']]:p-5",
      "md:after:content-['→']",
      "before:content-['✓']",
      "font-['Noto_Sans_日本']",
      "after:content-['🎉']",
    ];
    const css = await build(`@import "tailwindcss";`, classes);
    expect(classes.filter((cls) => !hasRule(css, cls))).toEqual([]);
    // And a longer name is still a longer name when it continues past ASCII.
    expect(hasRule(".geö { }", "ge")).toBe(false);
  });
});

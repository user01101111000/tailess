import { describe, expect, it } from "vitest";
import { extractClasses } from "../../src/extract/extract.js";
import { parseObject, scanCalls, splitArgs } from "../../src/extract/scan.js";

/**
 * The paths a normal fixture never reaches: escapes, template interpolation,
 * comments inside an argument list, and the guards that stop a malformed call from
 * taking the rest of the file with it.
 *
 * These matter more than their line count suggests. Every one of them decides
 * whether a class the user wrote reaches Tailwind, and when the answer is "no" the
 * failure is silent — the class lands on the element with no rule behind it.
 */
describe("escapes", () => {
  it("keeps an escaped quote inside a class string", () => {
    expect(extractClasses(`ss({ before: "content-[\\'x\\']" })`)).toEqual(["before:content-['x']"]);
  });

  it("does not let an escaped quote end the string early", () => {
    // The escaped quote stays inside the argument rather than closing it...
    expect(scanCalls(`on("hover", "a\\"b")`)).toEqual([
      { name: "on", args: ['"hover"', '"a\\"b"'] },
    ]);
    // ...so a following key is still seen. (The `"` class itself can't travel
    // through `@source inline("…")`, so it is dropped — deliberately.)
    expect(extractClasses(`ss({ md: "a\\"b", lg: "grid" })`)).toEqual(["lg:grid"]);
  });

  it("handles a backslash at the very end of the input", () => {
    expect(() => extractClasses(`ss({ md: "a\\`)).not.toThrow();
  });
});

describe("template literals", () => {
  it("uses an interpolation-free template as a class string", () => {
    expect(extractClasses("ss({ md: `text-lg font-bold` })")).toEqual([
      "md:font-bold",
      "md:text-lg",
    ]);
  });

  it("skips an interpolated template but keeps its siblings", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the interpolation is the subject.
    const code = "ss({ md: `text-${size}`, lg: 'grid' })";
    expect(extractClasses(code)).toEqual(["lg:grid"]);
  });

  it("survives quotes and nested templates inside an interpolation", () => {
    // The `${ ... }` scanner has to balance braces while skipping the strings and
    // templates inside, or the object's remaining keys are lost.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the interpolation is the subject.
    const code = "ss({ md: `p-${cond ? \"a\" : `b-${x}`}`, lg: 'grid', hover: 'underline' })";
    expect(extractClasses(code)).toEqual(["hover:underline", "lg:grid"]);
  });

  it("survives an object literal inside an interpolation", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the interpolation is the subject.
    const code = "ss({ md: `x-${ {a:1}.a }`, lg: 'grid' })";
    expect(extractClasses(code)).toEqual(["lg:grid"]);
  });

  it("does not hang on an unterminated template", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the interpolation is the subject.
    expect(() => extractClasses("ss({ md: `text-${size}")).not.toThrow();
  });
});

describe("comments inside an argument list", () => {
  it("ignores a line comment between properties", () => {
    const code = `ss({
      md: "text-lg", // the important one
      lg: "text-xl",
    })`;
    expect(extractClasses(code)).toEqual(["lg:text-xl", "md:text-lg"]);
  });

  it("ignores a block comment between properties", () => {
    const code = `ss({ md: "text-lg", /* TODO: revisit */ lg: "text-xl" })`;
    expect(extractClasses(code)).toEqual(["lg:text-xl", "md:text-lg"]);
  });

  it("does not read a brace or quote inside a comment as structure", () => {
    // An unbalanced `{` or a lone apostrophe in a comment would otherwise derail
    // the depth count and eat the rest of the call.
    const code = `ss({ md: "text-lg", /* don't count this { */ lg: "text-xl" })`;
    expect(extractClasses(code)).toEqual(["lg:text-xl", "md:text-lg"]);
  });

  it("does not emit a commented-out property", () => {
    const code = `ss({
      // xl: "text-3xl",
      md: "text-lg",
    })`;
    // The whole entry is trivia, so it leaves nothing to key off — and the live
    // property behind it still comes through.
    expect(extractClasses(code)).toEqual(["md:text-lg"]);
  });

  it("does not mistake a URL for a comment", () => {
    const code = `ss({ md: "bg-[url(https://x.test/a.png)]", lg: "grid" })`;
    expect(extractClasses(code)).toEqual(["lg:grid", "md:bg-[url(https://x.test/a.png)]"]);
  });
});

describe("malformed input stays contained", () => {
  it("drops an argument list longer than the cap instead of emitting its noise", () => {
    // Reached only when the `(` never belonged to a call, so there is nothing real
    // to lose — and 20k of prose must not become candidates.
    const code = `on(${"word ".repeat(6000)}`;
    expect(extractClasses(code)).toEqual([]);
  });

  it("still emits what a call held when the file simply ends mid-edit", () => {
    // A dev server reads files while they are being typed.
    expect(extractClasses(`ss({ md: "text-lg"`)).toEqual(["md:text-lg"]);
  });

  it("keeps scanning after a malformed call", () => {
    const code = `ss({ md: "a"\n\nss({ lg: "b" })\n\non("hover", "c")`;
    expect(extractClasses(code)).toEqual(expect.arrayContaining(["lg:b", "hover:c"]));
  });
});

describe("object parsing", () => {
  it("accepts every quoting style for a key", () => {
    expect(parseObject(`{ md: "a", "lg": "b", 'xl': "c", \`sm\`: "d" }`)).toEqual([
      { key: "md", value: '"a"' },
      { key: "lg", value: '"b"' },
      { key: "xl", value: '"c"' },
      { key: "sm", value: '"d"' },
    ]);
  });

  it("skips an entry with no top-level colon", () => {
    expect(parseObject(`{ spread, md: "a" }`)).toEqual([{ key: "md", value: '"a"' }]);
  });

  it("keeps a colon that belongs to a nested value", () => {
    expect(parseObject(`{ md: { "a:b": true }, lg: cond ? "x" : "y" }`)).toEqual([
      { key: "md", value: '{ "a:b": true }' },
      { key: "lg", value: 'cond ? "x" : "y"' },
    ]);
  });

  it("keeps a colon inside a template value", () => {
    const interpolated = `a:$\{b}`;
    expect(parseObject(`{ md: \`${interpolated}\`, lg: "x" }`)).toEqual([
      { key: "md", value: `\`${interpolated}\`` },
      { key: "lg", value: '"x"' },
    ]);
  });

  it("returns nothing for text that is not an object", () => {
    expect(parseObject(`"just a string"`)).toEqual([]);
    expect(parseObject(`{`)).toEqual([]);
    expect(parseObject(``)).toEqual([]);
  });
});

describe("argument splitting", () => {
  it("keeps a comma that belongs to a nested structure", () => {
    expect(splitArgs(`{ a: 1, b: 2 }, ["c", "d"], fn(1, 2)`)).toEqual([
      "{ a: 1, b: 2 }",
      '["c", "d"]',
      "fn(1, 2)",
    ]);
  });

  it("does not split at a comma inside a comment", () => {
    // The comment stays in the raw argument text — callers read it with
    // `extractStrings`, which skips comments — but it must not create an argument.
    expect(splitArgs(`"a" /* , not an arg */, "b"`)).toEqual(['"a" /* , not an arg */', '"b"']);
  });

  it("treats an apostrophe in prose as one character, not a string", () => {
    expect(splitArgs(`it's fine, "b"`)).toEqual(["it's fine", '"b"']);
  });
});

describe("line endings", () => {
  const lines = [
    "ss({",
    '  base: "flex",',
    "  // a note",
    '  md: "grid",',
    '  lg: "gap-8",',
    "});",
    'on("hover", "underline");',
  ];
  const expected = ["hover:underline", "lg:gap-8", "md:grid"];

  it.each([
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["CR", "\r"],
  ])("reads the same classes with %s line endings", (_name, eol) => {
    // A `//` comment that never finds its terminator swallows the rest of the file,
    // taking every call in it — so which characters end a line is load-bearing.
    expect(extractClasses(lines.join(eol))).toEqual(expected);
  });

  it("ignores a byte-order mark", () => {
    expect(extractClasses(`\uFEFF${lines.join("\r\n")}`)).toEqual(expected);
  });

  it("stops an unterminated string at the line break, whatever it is", () => {
    for (const eol of ["\n", "\r\n", "\r"]) {
      expect(extractClasses(`const s = "oops${eol}ss({ md: "grid" })`)).toEqual(["md:grid"]);
    }
  });
});

describe("pathological input never throws", () => {
  it("survives deeply nested template literals", () => {
    // extractClasses() is fed arbitrary bytes from every file in the project, so a
    // stack overflow here would escape the CSS transform and fail the whole build.
    const nested = "`${".repeat(20_000);
    expect(() => extractClasses(`ss({ md: ${nested} })`)).not.toThrow();
    expect(() => extractClasses("`".repeat(50_000))).not.toThrow();
  });

  it("survives deeply nested brackets", () => {
    expect(() => extractClasses(`on("hover", ${"(".repeat(50_000)}`)).not.toThrow();
    expect(() => extractClasses(`ss({ md: ${"[".repeat(50_000)}`)).not.toThrow();
  });

  it("still finds real calls in a file that also contains junk", () => {
    const junk = "`${".repeat(5_000);
    expect(extractClasses(`const x = ${junk};\nss({ lg: "grid" })`)).toContain("lg:grid");
  });
});

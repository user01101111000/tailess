import { describe, expect, it } from "vitest";
import {
  extractStrings,
  isArrayLiteral,
  parseObject,
  scanCalls,
  splitArgs,
} from "../../src/extract/scan.js";

describe("scanCalls", () => {
  it("finds a bare helper call and its args", () => {
    expect(scanCalls(`on("hover", "bg-blue-600")`)).toEqual([
      { name: "on", args: ['"hover"', '"bg-blue-600"'] },
    ]);
  });

  it("finds method calls on any receiver", () => {
    expect(scanCalls(`st.ss({ md: "text-2xl" })`)).toEqual([
      { name: "ss", args: ['{ md: "text-2xl" }'] },
    ]);
  });

  it("ignores identifiers that only share a suffix", () => {
    expect(scanCalls(`process(); myss("x"); across("y")`)).toEqual([]);
  });

  it("ignores calls inside string and template literals", () => {
    expect(scanCalls(`const x = "on(\\"hover\\", 'a')"; const y = \`ss({a:1})\`;`)).toEqual([]);
  });

  it("ignores calls inside comments", () => {
    expect(scanCalls(`// on("hover", "a")\n/* ss({ md: "b" }) */`)).toEqual([]);
  });

  it("finds multiple and nested calls", () => {
    const code = `cn(on("hover", "a"), ss({ md: "b" }))`;
    expect(scanCalls(code).map((c) => c.name)).toEqual(["on", "ss"]);
  });

  it("handles a property key named like a helper without matching it", () => {
    expect(scanCalls(`const o = { ss: 1, on: 2 };`)).toEqual([]);
  });
});

describe("splitArgs", () => {
  it("splits at the top level only", () => {
    expect(splitArgs(`"a", { b: 1, c: 2 }, ["d", "e"]`)).toEqual([
      '"a"',
      "{ b: 1, c: 2 }",
      '["d", "e"]',
    ]);
  });

  it("ignores commas inside strings", () => {
    expect(splitArgs(`"a,b", 'c,d'`)).toEqual(['"a,b"', "'c,d'"]);
  });

  it("returns an empty array for empty input", () => {
    expect(splitArgs("")).toEqual([]);
  });
});

describe("extractStrings", () => {
  it("collects single, double, and plain template literals", () => {
    expect(extractStrings("'a' + \"b\" + `c`")).toEqual(["a", "b", "c"]);
  });

  it("skips interpolated templates", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal is the test input.
    expect(extractStrings("`x-${y}`")).toEqual([]);
  });

  it("unescapes escaped quotes", () => {
    expect(extractStrings(`"a\\"b"`)).toEqual(['a"b']);
  });
});

describe("parseObject", () => {
  it("parses identifier, quoted, and numeric-like keys", () => {
    expect(parseObject(`{ md: "a", "3xl": "b", hover: "c" }`)).toEqual([
      { key: "md", value: '"a"' },
      { key: "3xl", value: '"b"' },
      { key: "hover", value: '"c"' },
    ]);
  });

  it("skips spread and computed keys", () => {
    expect(parseObject(`{ ...rest, [dyn]: "a", md: "b" }`)).toEqual([{ key: "md", value: '"b"' }]);
  });

  it("keeps ternary colons inside values", () => {
    expect(parseObject(`{ md: cond ? "a" : "b" }`)).toEqual([
      { key: "md", value: 'cond ? "a" : "b"' },
    ]);
  });

  it("returns empty for non-object text", () => {
    expect(parseObject(`"just a string"`)).toEqual([]);
  });
});

describe("isArrayLiteral", () => {
  it("detects array literals ignoring leading whitespace", () => {
    expect(isArrayLiteral(`  ["dark", "hover"]`)).toBe(true);
    expect(isArrayLiteral(`"hover"`)).toBe(false);
  });
});

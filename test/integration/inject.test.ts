import { describe, expect, it } from "vitest";
import {
  afterStatements,
  buildPrelude,
  markerRule,
  sourceLiterals,
} from "../../src/integration/inject.js";

describe("sourceLiterals", () => {
  it("returns nothing for no candidates", () => {
    expect(sourceLiterals([])).toEqual([]);
  });

  it("joins candidates with a single space, double-quoted", () => {
    expect(sourceLiterals(["md:flex", "hover:underline"])).toEqual(['"md:flex hover:underline"']);
  });

  it("splits large lists so no directive becomes an unreadable single line", () => {
    const many = Array.from({ length: 450 }, (_, i) => `md:p-${i}`);
    const literals = sourceLiterals(many);
    expect(literals).toHaveLength(3);
    expect(
      literals
        .map((l) => l.slice(1, -1))
        .join(" ")
        .split(" "),
    ).toHaveLength(450);
  });

  it("never emits a newline — Tailwind throws on those inside inline()", () => {
    const many = Array.from({ length: 1000 }, (_, i) => `md:p-${i}`);
    for (const literal of sourceLiterals(many)) expect(literal).not.toMatch(/[\r\n]/);
  });

  it("carries a double quote in a single-quoted directive of its own", () => {
    // Tailwind reads neither \" nor \22 inside the string, so the other quote is the only
    // way; such a class used to be dropped and was silently unstyled.
    expect(sourceLiterals(["md:p-4", 'md:after:content-["x"]'])).toEqual([
      '"md:p-4"',
      `'md:after:content-["x"]'`,
    ]);
  });
});

describe("afterStatements", () => {
  const font = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");`;

  it("is 0 when the stylesheet opens with anything but a statement", () => {
    expect(afterStatements("")).toBe(0);
    expect(afterStatements(".a { color: red }")).toBe(0);
    expect(afterStatements("@layer base { .a {} }")).toBe(0);
    expect(afterStatements("@theme { --color-x: red; }")).toBe(0);
  });

  it("steps over every leading @import, @charset and statement-form @layer", () => {
    const css = `@charset "utf-8";\n${font}\n@layer theme, base;\n@import "tailwindcss";\n.a {}`;
    expect(css.slice(afterStatements(css))).toBe("\n.a {}");
  });

  it("reads a quoted URL's semicolons as part of the URL", () => {
    // `wght@400;700` ended the statement there, and the injection split the URL.
    expect(afterStatements(font)).toBe(font.length);
  });

  it("steps over comments and Tailwind's own statements", () => {
    const css = `/* fonts */\n@plugin "x";\n@source "../ui";\n${font}\n@theme { }`;
    expect(css.slice(afterStatements(css))).toBe("\n@theme { }");
  });

  it("stops at an unterminated statement rather than swallowing the file", () => {
    expect(afterStatements(`@import "tailwindcss";\n@import "x"`)).toBe(22);
  });
});

describe("buildPrelude", () => {
  it("emits the marker rule even when there are no candidates", () => {
    expect(buildPrelude([])).toBe(`${markerRule}\n`);
  });

  it("emits the marker plus a @source directive", () => {
    expect(buildPrelude(["md:flex"])).toBe(`${markerRule}\n@source inline("md:flex");\n`);
  });
});

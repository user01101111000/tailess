import { describe, expect, it } from "vitest";
import { buildPrelude, markerRule, sourceLiterals } from "../../src/integration/inject.js";

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

describe("buildPrelude", () => {
  it("emits the marker rule even when there are no candidates", () => {
    expect(buildPrelude([])).toBe(`${markerRule}\n`);
  });

  it("emits the marker plus a @source directive", () => {
    expect(buildPrelude(["md:flex"])).toBe(`${markerRule}\n@source inline("md:flex");\n`);
  });
});

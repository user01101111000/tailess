import { describe, expect, it } from "vitest";
import { buildPrelude, markerRule, sourceChunks } from "../../src/integration/inject.js";

describe("sourceChunks", () => {
  it("returns nothing for no candidates", () => {
    expect(sourceChunks([])).toEqual([]);
  });

  it("joins candidates with a single space", () => {
    expect(sourceChunks(["md:flex", "hover:underline"])).toEqual(["md:flex hover:underline"]);
  });

  it("splits large lists so no directive becomes an unreadable single line", () => {
    const many = Array.from({ length: 450 }, (_, i) => `md:p-${i}`);
    const chunks = sourceChunks(many);
    expect(chunks).toHaveLength(3);
    expect(chunks.join(" ").split(" ")).toHaveLength(450);
  });

  it("never emits a newline — Tailwind throws on those inside inline()", () => {
    const many = Array.from({ length: 1000 }, (_, i) => `md:p-${i}`);
    for (const chunk of sourceChunks(many)) expect(chunk).not.toMatch(/[\r\n]/);
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

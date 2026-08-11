import { describe, expect, it } from "vitest";
import { withPrefix } from "../../src/utils/prefix.js";

describe("withPrefix", () => {
  it("prefixes every token", () => {
    expect(withPrefix("md", "text-lg font-bold")).toBe("md:text-lg md:font-bold");
  });

  it("collapses whitespace", () => {
    expect(withPrefix("md", "  text-lg\n\tfont-bold  ")).toBe("md:text-lg md:font-bold");
  });

  it("accepts clsx-style values", () => {
    expect(withPrefix("hover", ["a", false && "b", { c: true, d: false }])).toBe("hover:a hover:c");
  });

  it("supports arbitrary variants tailess does not model as keys", () => {
    expect(withPrefix("supports-[display:grid]", "grid")).toBe("supports-[display:grid]:grid");
    expect(withPrefix("has-[:checked]", "bg-blue-50")).toBe("has-[:checked]:bg-blue-50");
  });

  it("returns an empty string when there is nothing to prefix", () => {
    expect(withPrefix("md", "")).toBe("");
    expect(withPrefix("md", null)).toBe("");
    expect(withPrefix("md", [])).toBe("");
  });
});

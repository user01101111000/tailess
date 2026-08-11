import { describe, expect, it } from "vitest";
import { between, until } from "../../src/utils/range.js";

describe("until", () => {
  it("builds a max-width variant", () => {
    expect(until("md", "hidden")).toBe("max-md:hidden");
  });

  it("prefixes every token", () => {
    expect(until("lg", "hidden opacity-0")).toBe("max-lg:hidden max-lg:opacity-0");
  });

  it("returns an empty string for empty classes", () => {
    expect(until("md", false)).toBe("");
  });
});

describe("between", () => {
  it("stacks a min-width and a max-width variant", () => {
    expect(between("sm", "lg", "block")).toBe("sm:max-lg:block");
  });

  it("prefixes every token", () => {
    expect(between("md", "xl", "flex gap-2")).toBe("md:max-xl:flex md:max-xl:gap-2");
  });

  it("returns an empty string for empty classes", () => {
    expect(between("sm", "lg", null)).toBe("");
  });
});

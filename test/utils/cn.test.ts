import { describe, expect, it } from "vitest";
import { cn } from "../../src/utils/cn.js";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("drops falsy values", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("supports conditional objects and arrays", () => {
    expect(cn("base", { active: true, hidden: false }, ["a", "b"])).toBe("base active a b");
  });

  it("resolves conflicting Tailwind utilities (last wins)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

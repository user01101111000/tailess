import { describe, expect, it } from "vitest";
import { cn } from "../../src/utils/cn.js";
import { ss } from "../../src/utils/ss.js";

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

describe("the utilities newer Tailwind releases added", () => {
  // tailwind-merge learned the 4.2 logical utilities in 3.5.0 and the radial/conic
  // gradient conflict in 3.7.0. Below that it keeps both classes, and the winner is
  // whichever rule Tailwind happens to emit later — the *earlier* class, every time
  // this was measured. The dependency floor is what these hold to.
  it("lets a later logical-property utility win", () => {
    expect(ss({ base: "mbs-2" }, { base: "mbs-1" })).toBe("mbs-1");
    expect(cn("inset-s-4", "inset-s-2")).toBe("inset-s-2");
    expect(cn("block-8", "block-4")).toBe("block-4");
  });

  it("lets a later gradient shape win", () => {
    expect(cn("bg-radial", "bg-conic")).toBe("bg-conic");
  });
});

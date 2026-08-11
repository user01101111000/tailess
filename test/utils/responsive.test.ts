import { describe, expect, it } from "vitest";
import { responsive } from "../../src/utils/responsive.js";

describe("responsive", () => {
  it("emits breakpoints mobile-first after the base", () => {
    expect(responsive("text-sm", { md: "text-lg", xl: "text-2xl" })).toBe(
      "text-sm md:text-lg xl:text-2xl",
    );
  });

  it("ignores the order the variants were written in", () => {
    expect(responsive("p-1", { "2xl": "p-8", sm: "p-2", lg: "p-4" })).toBe(
      "p-1 sm:p-2 lg:p-4 2xl:p-8",
    );
  });

  it("works with no variants", () => {
    expect(responsive("flex")).toBe("flex");
    expect(responsive("flex", {})).toBe("flex");
  });

  it("skips falsy variants, prefix included", () => {
    expect(responsive("grid", { md: false, lg: undefined, xl: "gap-4" })).toBe("grid xl:gap-4");
  });

  it("merges conflicts through cn", () => {
    expect(responsive("text-sm text-base", { md: "p-2 p-4" })).toBe("text-base md:p-4");
  });
});

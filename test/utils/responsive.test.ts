import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { responsive } from "../../src/utils/responsive.js";

describe("responsive", () => {
  it("returns the base when there are no variants", () => {
    expect(responsive(defaultConfig, "text-sm")).toBe("text-sm");
  });

  it("prefixes each variant with its breakpoint key", () => {
    expect(responsive(defaultConfig, "text-sm", { md: "text-lg" })).toBe("text-sm md:text-lg");
  });

  it("prefixes every token in a multi-class variant", () => {
    expect(responsive(defaultConfig, "block", { lg: "flex items-center" })).toBe(
      "block lg:flex lg:items-center",
    );
  });

  it("emits breakpoints in config order, not argument order", () => {
    expect(responsive(defaultConfig, "text-sm", { xl: "text-2xl", md: "text-lg" })).toBe(
      "text-sm md:text-lg xl:text-2xl",
    );
  });

  it("supports custom breakpoint keys from the config", () => {
    const config = resolveConfig({ screens: { "3xl": "1600px" } });
    expect(responsive(config, "text-sm", { "3xl": "text-2xl" })).toBe("text-sm 3xl:text-2xl");
  });

  it("skips nullish/false variant values", () => {
    expect(responsive(defaultConfig, "text-sm", { md: false, lg: "text-lg" })).toBe(
      "text-sm lg:text-lg",
    );
  });
});

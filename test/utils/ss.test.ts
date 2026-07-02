import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { ss } from "../../src/utils/ss.js";

describe("ss", () => {
  it("keeps base unprefixed and prefixes each breakpoint key", () => {
    expect(ss(defaultConfig, { base: "text-xl flex", sm: "block", md: "text-2xl" })).toBe(
      "text-xl flex sm:block md:text-2xl",
    );
  });

  it("works with only a base", () => {
    expect(ss(defaultConfig, { base: "grid gap-4" })).toBe("grid gap-4");
  });

  it("works with no base", () => {
    expect(ss(defaultConfig, { md: "flex", lg: "grid" })).toBe("md:flex lg:grid");
  });

  it("emits breakpoints in config order, not object order", () => {
    expect(ss(defaultConfig, { xl: "text-3xl", base: "text-sm", md: "text-lg" })).toBe(
      "text-sm md:text-lg xl:text-3xl",
    );
  });

  it("supports state keys and custom aliases", () => {
    const config = resolveConfig({ states: { groupHover: "group-hover" } });
    expect(ss(config, { base: "opacity-0", hover: "opacity-100", groupHover: "flex" })).toBe(
      "opacity-0 hover:opacity-100 group-hover:flex",
    );
  });

  it("supports custom breakpoints from config", () => {
    const config = resolveConfig({ screens: { "3xl": "1600px" } });
    expect(ss(config, { base: "text-sm", "3xl": "text-2xl" })).toBe("text-sm 3xl:text-2xl");
  });

  it("skips nullish/false values", () => {
    expect(ss(defaultConfig, { base: "flex", sm: false, md: "grid" })).toBe("flex md:grid");
  });

  it("does not warn for a registered key whose value is falsy", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ss(defaultConfig, { base: "flex", lg: false, md: undefined })).toBe("flex");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns only for unknown keys that actually carry classes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ss(defaultConfig, { base: "flex", nope: "block", blank: false })).toBe(
      "flex nope:block",
    );
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

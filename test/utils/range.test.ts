import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/config/defaults.js";
import { resolveConfig } from "../../src/config/resolve.js";
import { between, until } from "../../src/utils/range.js";

describe("until", () => {
  it("prefixes classes with the max- breakpoint variant", () => {
    expect(until(defaultConfig, "md", "hidden")).toBe("max-md:hidden");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(until(defaultConfig, "lg", "flex items-center")).toBe("max-lg:flex max-lg:items-center");
  });

  it("supports custom breakpoint keys", () => {
    const config = resolveConfig({ screens: { "3xl": "1600px" } });
    expect(until(config, "3xl", "block")).toBe("max-3xl:block");
  });

  it("still emits but warns in dev for unknown breakpoints", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(until(defaultConfig, "nope", "block")).toBe("max-nope:block");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("between", () => {
  it("combines a min-width variant with a max- variant", () => {
    expect(between(defaultConfig, "sm", "lg", "block")).toBe("sm:max-lg:block");
  });

  it("prefixes every token in a multi-class value", () => {
    expect(between(defaultConfig, "md", "xl", "flex gap-2")).toBe("md:max-xl:flex md:max-xl:gap-2");
  });

  it("warns for each unknown endpoint", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(between(defaultConfig, "foo", "bar", "block")).toBe("foo:max-bar:block");
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

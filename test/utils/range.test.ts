import { describe, expect, it, vi } from "vitest";
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

describe("between — an empty range", () => {
  it("warns when min is not narrower than max", () => {
    // `lg:max-sm:` compiles to real CSS that no viewport can ever satisfy, so it
    // passes every other check and silently styles nothing.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(between("lg", "sm", "block")).toBe("lg:max-sm:block");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('between("sm", "lg"');
    warn.mockRestore();
  });

  it("warns when both breakpoints are the same", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    between("md", "md", "block");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("stays quiet for a real range", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(between("sm", "lg", "block")).toBe("sm:max-lg:block");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

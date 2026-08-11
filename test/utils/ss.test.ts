import { describe, expect, it, vi } from "vitest";
import { ss } from "../../src/utils/ss.js";

describe("ss", () => {
  it("keeps base unprefixed and prefixes each breakpoint key", () => {
    expect(ss({ base: "text-xl flex", sm: "block", md: "text-2xl" })).toBe(
      "text-xl flex sm:block md:text-2xl",
    );
  });

  it("works with only a base", () => {
    expect(ss({ base: "grid gap-4" })).toBe("grid gap-4");
  });

  it("works with no base", () => {
    expect(ss({ md: "flex", lg: "grid" })).toBe("md:flex lg:grid");
  });

  it("emits in canonical order, not object order", () => {
    expect(ss({ xl: "text-3xl", base: "text-sm", md: "text-lg" })).toBe(
      "text-sm md:text-lg xl:text-3xl",
    );
  });

  it("orders base, then breakpoints, then max-* ranges, then states", () => {
    expect(
      ss({
        hover: "underline",
        "max-md": "gap-2",
        md: "flex",
        base: "grid",
        "max-sm": "gap-1",
        lg: "block",
      }),
    ).toBe("grid md:flex lg:block max-md:gap-2 max-sm:gap-1 hover:underline");
  });

  it("prefixes every token in a multi-class bucket", () => {
    expect(ss({ md: "text-2xl font-bold uppercase" })).toBe(
      "md:text-2xl md:font-bold md:uppercase",
    );
  });

  it("supports Tailwind's state variants verbatim, in stateKeys order", () => {
    expect(
      ss({ base: "opacity-0", "group-hover": "flex", hover: "opacity-100", dark: "bg-black" }),
    ).toBe("opacity-0 hover:opacity-100 dark:bg-black group-hover:flex");
  });

  it("skips nullish/false/empty values, prefix included", () => {
    expect(ss({ base: "flex", sm: false, md: "grid", lg: undefined, xl: "" })).toBe("flex md:grid");
  });

  it("accepts clsx-style conditional values", () => {
    expect(
      ss({ base: ["flex", false && "hidden"], md: { "text-2xl": true, "text-xs": false } }),
    ).toBe("flex md:text-2xl");
  });

  it("merges conflicting utilities within the same prefix", () => {
    expect(ss({ base: "px-2 px-4", md: "text-sm text-lg" })).toBe("px-4 md:text-lg");
  });

  it("does not warn for a known key whose value is falsy", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ss({ base: "flex", lg: false, md: undefined })).toBe("flex");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns for an unknown key but still emits it, sorted last", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error "nope" is not a Tailwind breakpoint or state variant.
    expect(ss({ nope: "block", base: "flex", md: "grid" })).toBe("flex md:grid nope:block");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("does not warn for an unknown key with a falsy value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error "blank" is not a Tailwind breakpoint or state variant.
    expect(ss({ base: "flex", blank: false })).toBe("flex");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats Object.prototype keys as literal prefixes", () => {
    // Regression: a prototype lookup used to resolve `toString` to the inherited
    // function, producing a garbage prefix.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error "toString" is not a Tailwind breakpoint or state variant.
    expect(ss({ base: "flex", toString: "block" })).toBe("flex toString:block");
    warn.mockRestore();
  });

  it("returns an empty string for an empty input", () => {
    expect(ss({})).toBe("");
  });
});

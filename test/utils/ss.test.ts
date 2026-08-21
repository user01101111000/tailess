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
      ss({ base: ["flex", false && "hidden"], md: [{ "text-2xl": true, "text-xs": false }] }),
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

describe("ss, composing several arguments", () => {
  it("returns an empty string with no arguments", () => {
    expect(ss()).toBe("");
  });

  it("behaves exactly like cn when given only class values", () => {
    expect(ss("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
  });

  it("joins several maps, each sorted on its own", () => {
    expect(ss({ md: "text-lg", base: "flex" }, { hover: "underline", base: "gap-2" })).toBe(
      "flex md:text-lg gap-2 hover:underline",
    );
  });

  it("skips falsy arguments, which is what makes a condition inline", () => {
    const off = false;
    expect(ss({ base: "rounded p-4" }, off && { base: "opacity-50", sm: "bg-red-500" })).toBe(
      "rounded p-4",
    );
    const on = true;
    expect(ss({ base: "rounded p-4" }, on && { base: "opacity-50", sm: "bg-red-500" })).toBe(
      "rounded p-4 opacity-50 sm:bg-red-500",
    );
  });

  it("keeps arguments in written order, so a later one wins the conflict", () => {
    expect(ss({ base: "p-4" }, { base: "p-8" })).toBe("p-8");
    expect(ss({ md: "p-6" }, { md: "p-10" })).toBe("md:p-10");
  });

  it("lets a trailing className override a breakpoint set earlier", () => {
    // The reason arguments are never reordered: sorting a raw string into the `base`
    // bucket would put it ahead of `md:p-6` and quietly lose to it.
    expect(ss({ base: "p-4", md: "p-6" }, "md:p-10")).toBe("p-4 md:p-10");
  });

  it("accepts a mix of maps, strings, arrays and conditions", () => {
    expect(
      ss(
        { base: "rounded border", md: "p-6" },
        ["shadow-sm", false && "shadow-lg"],
        null,
        undefined,
        "text-sm",
      ),
    ).toBe("rounded border md:p-6 shadow-sm text-sm");
  });

  it("still emits a single argument through the fast path unchanged", () => {
    expect(ss({ base: "text-xl flex", sm: "block" })).toBe("text-xl flex sm:block");
    expect(ss("px-2 px-4")).toBe("px-4");
    expect(ss(["flex", false && "hidden"])).toBe("flex");
    expect(ss(false)).toBe("");
    expect(ss(null)).toBe("");
  });
});

describe("ss, nested buckets", () => {
  it("stacks a nested key onto its parent's prefix", () => {
    expect(ss({ dark: { hover: "bg-black" } })).toBe("dark:hover:bg-black");
  });

  it("reads a nested base as the parent prefix on its own", () => {
    expect(ss({ dark: { base: "text-white", hover: "text-blue-300" } })).toBe(
      "dark:text-white dark:hover:text-blue-300",
    );
  });

  it("treats a bare string and a base-only map as the same thing", () => {
    expect(ss({ md: "p-6" })).toBe(ss({ md: { base: "p-6" } }));
  });

  it("expresses a breakpoint range without between()", () => {
    expect(ss({ md: { "max-lg": "grid" } })).toBe("md:max-lg:grid");
  });

  it("sorts nested keys canonically too", () => {
    expect(ss({ md: { hover: "p-8", base: "p-6", "max-lg": "grid" } })).toBe(
      "md:p-6 md:max-lg:grid md:hover:p-8",
    );
  });

  it("drops a falsy nested bucket, prefix included", () => {
    expect(ss({ md: { base: "p-6", hover: false, focus: undefined } })).toBe("md:p-6");
  });

  it("drops a nested map that resolves to nothing", () => {
    expect(ss({ base: "flex", md: {} })).toBe("flex");
    expect(ss({ base: "flex", md: { hover: "" } })).toBe("flex");
  });

  it("nests more than one level", () => {
    expect(ss({ md: { dark: { hover: "bg-black" } } })).toBe("md:dark:hover:bg-black");
  });

  it("merges conflicts across nesting depths", () => {
    // tailwind-merge normalizes modifier order, so these are the same key.
    expect(ss({ md: { hover: "p-2" } }, { hover: { md: "p-4" } })).toBe("hover:md:p-4");
  });

  it("warns for an unknown nested key but still emits it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error "nope" is not a Tailwind breakpoint or state variant.
    expect(ss({ md: { nope: "block", base: "flex" } })).toBe("md:flex md:nope:block");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("treats an object inside an array as clsx classes, never as a nested map", () => {
    expect(ss({ md: [{ "text-2xl": true, hover: false }] })).toBe("md:text-2xl");
  });

  it("stops descending instead of overflowing on an object that contains itself", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cyclic: Record<string, unknown> = { base: "flex" };
    cyclic.md = cyclic;
    const input = cyclic as unknown as Parameters<typeof ss>[0];
    expect(() => ss(input)).not.toThrow();
    expect(ss(input)).toContain("flex");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { variants } from "../../src/utils/variants.js";

/**
 * A `cva`-shaped recipe, with the one difference that makes it worth having here:
 * every value is an `SsArg`, so a variant option can be an `ss` map rather than a
 * flat string. `lg: { base: "text-lg", md: "px-6" }` is a variant that carries its
 * own breakpoint — which a plain string cannot express, and which is the whole reason
 * this package exists.
 */

const button = variants({
  base: { base: "rounded font-medium", hover: "brightness-110" },
  variants: {
    tone: { primary: "bg-blue-600", danger: "bg-red-600" },
    size: { sm: "text-sm px-2", lg: { base: "text-lg px-4", md: "px-6" } },
  },
  compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
  defaults: { tone: "primary", size: "sm" },
});

describe("variants", () => {
  it("applies the defaults when called with nothing", () => {
    expect(button()).toBe("rounded font-medium hover:brightness-110 bg-blue-600 text-sm px-2");
  });

  it("lets an option be an ss map, which is the point", () => {
    expect(button({ size: "lg" })).toContain("md:px-6");
  });

  it("emits base, then the variants, then the compounds", () => {
    expect(button({ tone: "danger", size: "lg" })).toBe(
      "rounded font-medium hover:brightness-110 bg-red-600 text-lg px-4 md:px-6 ring-2",
    );
  });

  it("applies a compound rule only when every named variant matches", () => {
    expect(button({ tone: "danger", size: "sm" })).not.toContain("ring-2");
    expect(button({ tone: "primary", size: "lg" })).not.toContain("ring-2");
  });

  it("does not let an explicitly undefined prop erase a default", () => {
    // What a component writes when it forwards an optional prop it did not receive.
    expect(button({ size: undefined })).toBe(button());
  });

  it("takes extra arguments like cn, and the last one still wins", () => {
    expect(button({}, "underline")).toContain("underline");
    const t = variants({ base: "p-2", variants: { s: { a: "p-4" } }, defaults: { s: "a" } });
    expect(t({}, "p-8")).toBe("p-8");
  });

  it("drops a falsy extra argument", () => {
    expect(button({}, false)).toBe(button());
  });

  it("works with no defaults and no compounds", () => {
    const box = variants({ variants: { pad: { none: "p-0", lots: { base: "p-8", md: "p-12" } } } });
    expect(box()).toBe("");
    expect(box({ pad: "lots" })).toBe("p-8 md:p-12");
  });

  it("ignores an option name that is not one of its own", () => {
    // Only reachable from JavaScript — the type is a closed union — but a `Record`
    // read would find `toString` on the prototype and put it in a className.
    const t = variants({ variants: { s: { a: "p-4" } } });
    expect(t({ s: "toString" } as never)).toBe("");
    expect(t({ s: "constructor" } as never)).toBe("");
  });

  it("merges conflicts across base, variants and compounds", () => {
    // It ends in `ss`, so `tailwind-merge` runs over the whole thing exactly once.
    const t = variants({
      base: "p-2",
      variants: { s: { a: "p-4" } },
      compound: [{ s: "a", class: "p-6" }],
      defaults: { s: "a" },
    });
    expect(t()).toBe("p-6");
  });

  it("keeps each variant's order stable, whatever order the props arrive in", () => {
    // Variants are emitted in declaration order, not call order, so the same props
    // always produce the same string and `tailwind-merge` stays predictable.
    expect(button({ size: "lg", tone: "danger" })).toBe(button({ tone: "danger", size: "lg" }));
  });
});

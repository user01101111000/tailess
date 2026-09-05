import { describe, expect, expectTypeOf, it } from "vitest";
import { type VariantProps, variants } from "../../src/utils/variants.js";

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

  it("carries its variants, so VariantProps can be read off the component", () => {
    // `VariantProps<typeof button>` is the spelling every cva-shaped library uses,
    // and the one a component reaches for to declare its own props. Parameterising
    // the type on the groups alone left that spelling a compile error.
    type Props = VariantProps<typeof button>;
    expectTypeOf<Props>().toEqualTypeOf<{
      tone?: "primary" | "danger" | undefined;
      size?: "sm" | "lg" | undefined;
    }>();

    // @ts-expect-error "medium" is not one of size's options.
    const bad: Props = { size: "medium" };
    expect(bad).toBeDefined();

    // The same type off the groups, for a config written apart from the call.
    expectTypeOf<VariantProps<{ tone: { primary: string } }>>().toEqualTypeOf<{
      tone?: "primary" | undefined;
    }>();

    expect(Object.keys(button.variants)).toEqual(["tone", "size"]);
    expect(Object.keys(button.variants.size)).toEqual(["sm", "lg"]);
  });

  it("keeps each variant's order stable, whatever order the props arrive in", () => {
    // Variants are emitted in declaration order, not call order, so the same props
    // always produce the same string and `tailwind-merge` stays predictable.
    expect(button({ size: "lg", tone: "danger" })).toBe(button({ tone: "danger", size: "lg" }));
  });
});

describe("a boolean variant", () => {
  const box = variants({
    base: "rounded",
    variants: {
      disabled: { true: "opacity-50", false: "opacity-100" },
      loading: { true: "animate-pulse" },
    },
    defaults: { disabled: false },
  });

  it("takes the boolean a component already has", () => {
    // The most common variant kind there is, and the one both cva and tv type as
    // `boolean` — so a component can forward `disabled` rather than stringify it.
    expect(box({ disabled: true })).toBe("rounded opacity-50");
    expect(box({ disabled: false })).toBe("rounded opacity-100");
    expect(box({ loading: true })).toBe("rounded opacity-100 animate-pulse");
  });

  it("still takes the string spellings, which are the real option keys", () => {
    expect(box({ disabled: "true" })).toBe(box({ disabled: true }));
    expect(box({ disabled: "false" })).toBe(box({ disabled: false }));
  });

  it("reads a boolean default too", () => {
    expect(box()).toBe("rounded opacity-100");
  });

  it("types the prop as boolean", () => {
    expectTypeOf<VariantProps<typeof box>>().toEqualTypeOf<{
      disabled?: boolean | "true" | "false" | undefined;
      loading?: boolean | "true" | undefined;
    }>();
  });

  it("leaves a non-boolean group alone", () => {
    const t = variants({ variants: { size: { sm: "p-1", lg: "p-4" } } });
    // @ts-expect-error a size is not a boolean.
    expect(t({ size: true })).toBeDefined();
  });
});

describe("a compound rule matching a list", () => {
  const button = variants({
    base: "rounded",
    variants: {
      tone: { primary: "bg-blue-600", danger: "bg-red-600", warning: "bg-amber-500" },
      size: { sm: "text-sm", md: "text-base", lg: "text-lg" },
    },
    compound: [{ tone: ["danger", "warning"], size: ["md", "lg"], class: "ring-2" }],
    defaults: { tone: "primary", size: "sm" },
  });

  it("matches any option in the list", () => {
    // Without this, four alternatives are four literal rules kept in step by hand,
    // and the count is multiplicative.
    expect(button({ tone: "danger", size: "md" })).toContain("ring-2");
    expect(button({ tone: "warning", size: "lg" })).toContain("ring-2");
  });

  it("does not match outside it", () => {
    expect(button({ tone: "primary", size: "lg" })).not.toContain("ring-2");
    expect(button({ tone: "danger", size: "sm" })).not.toContain("ring-2");
  });

  it("still matches a single option, and a boolean one", () => {
    const t = variants({
      variants: { on: { true: "underline", false: "" }, tone: { a: "p-1", b: "p-2" } },
      compound: [{ on: true, tone: ["a", "b"], class: "ring-1" }],
    });
    expect(t({ on: true, tone: "a" })).toContain("ring-1");
    expect(t({ on: false, tone: "a" })).not.toContain("ring-1");
  });
});

describe("the cva and tailwind-variants spellings", () => {
  it("accepts compoundVariants, defaultVariants and className", () => {
    // A ported recipe should need nothing changed but the function name.
    const button = variants({
      base: "rounded",
      variants: { tone: { primary: "bg-blue-600", danger: "bg-red-600" } },
      compoundVariants: [{ tone: "danger", className: "ring-2" }],
      defaultVariants: { tone: "danger" },
    });
    expect(button()).toBe("rounded bg-red-600 ring-2");
    expect(button({ tone: "primary" })).toBe("rounded bg-blue-600");
  });

  it("prefers the tailess name when both are given", () => {
    const t = variants({
      variants: { s: { a: "p-1", b: "p-2" } },
      defaults: { s: "a" },
      defaultVariants: { s: "b" },
    });
    expect(t()).toBe("p-1");
  });
});

describe("slots — a component with named parts", () => {
  const card = variants({
    slots: {
      root: { base: "rounded-lg border", dark: "border-neutral-800" },
      title: "font-semibold",
      body: "text-sm",
    },
    variants: {
      size: {
        sm: { root: "p-3", title: "text-base" },
        lg: { root: { base: "p-5", md: "p-8" }, title: "text-xl" },
      },
      tone: { danger: { root: "border-red-500", title: "text-red-700" } },
    },
    compound: [{ size: "lg", tone: "danger", class: { root: "ring-2" } }],
    defaults: { size: "sm" },
  });

  it("returns one class string per part", () => {
    const parts = card();
    expect(parts).toEqual({
      root: "rounded-lg border dark:border-neutral-800 p-3",
      title: "font-semibold text-base",
      body: "text-sm",
    });
  });

  it("lets a slot's value be an ss map, same as anywhere else", () => {
    expect(card({ size: "lg" }).root).toContain("md:p-8");
  });

  it("adds only the slots an option names", () => {
    const parts = card({ tone: "danger" });
    expect(parts.root).toContain("border-red-500");
    expect(parts.title).toContain("text-red-700");
    // `body` is named by no option, so it is exactly its slot default.
    expect(parts.body).toBe("text-sm");
  });

  it("applies a compound rule per slot", () => {
    expect(card({ size: "lg", tone: "danger" }).root).toContain("ring-2");
    expect(card({ size: "sm", tone: "danger" }).root).not.toContain("ring-2");
  });

  it("takes extra classes per slot, and the last one still wins", () => {
    const parts = card({}, { root: "p-10", title: "text-3xl" });
    expect(parts.root).toContain("p-10");
    expect(parts.root).not.toContain("p-3");
    expect(parts.title).toContain("text-3xl");
  });

  it("merges each slot on its own, once", () => {
    // `p-3` from the size option and `p-10` from the caller conflict; `body` is
    // untouched by either, which is the point of merging per part.
    expect(card({}, { root: "p-10" }).body).toBe("text-sm");
  });

  it("types the parts and the props", () => {
    expectTypeOf(card()).toEqualTypeOf<{ root: string; title: string; body: string }>();
    expectTypeOf<VariantProps<typeof card>>().toEqualTypeOf<{
      size?: "sm" | "lg" | undefined;
      tone?: "danger" | undefined;
    }>();
    // @ts-expect-error "footer" is not a slot.
    card({}, { footer: "p-2" });
  });

  it("ignores a slot name off the prototype", () => {
    const t = variants({ slots: { root: "p-1" }, variants: { s: { a: { root: "p-2" } } } });
    expect(t({ s: "toString" } as never).root).toBe("p-1");
  });
});

describe("extend — building on another recipe", () => {
  const base = variants({
    base: "rounded",
    variants: {
      tone: { primary: "bg-blue-600", danger: "bg-red-600" },
      size: { sm: "text-sm", lg: { base: "text-lg", md: "px-6" } },
    },
    compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
    defaults: { tone: "primary", size: "sm" },
  });

  const brand = variants({
    extend: base,
    base: "font-medium",
    variants: { tone: { brand: "bg-violet-600" } },
    defaults: { tone: "brand" },
  });

  it("keeps the parent's base and adds its own, in order", () => {
    expect(brand()).toBe("rounded font-medium bg-violet-600 text-sm");
  });

  it("merges per option, so an inherited one is not dropped", () => {
    // The whole reason to extend rather than copy: adding one `tone` must not lose
    // `primary` and `danger`.
    expect(brand({ tone: "danger" })).toContain("bg-red-600");
    expect(brand({ tone: "primary" })).toContain("bg-blue-600");
    expect(Object.keys(brand.variants.tone)).toEqual(["primary", "danger", "brand"]);
  });

  it("inherits the parent's compounds", () => {
    expect(brand({ tone: "danger", size: "lg" })).toContain("ring-2");
  });

  it("lets the child's defaults win", () => {
    expect(brand()).toContain("bg-violet-600");
    expect(base()).toContain("bg-blue-600");
  });

  it("types the merged variants", () => {
    expectTypeOf<VariantProps<typeof brand>>().toEqualTypeOf<{
      tone?: "primary" | "danger" | "brand" | undefined;
      size?: "sm" | "lg" | undefined;
    }>();
  });

  it("leaves the parent alone", () => {
    expect(Object.keys(base.variants.tone)).toEqual(["primary", "danger"]);
    expect(base()).toBe("rounded bg-blue-600 text-sm");
  });

  it("extends a slotted recipe too", () => {
    const card = variants({
      slots: { root: "rounded", title: "font-semibold" },
      variants: { size: { sm: { root: "p-2" } } },
    });
    const wide = variants({
      extend: card,
      slots: { root: "border", footer: "text-xs" },
      variants: { size: { lg: { root: "p-6", footer: "pt-2" } } },
    });
    expect(wide({ size: "lg" })).toEqual({
      root: "rounded border p-6",
      title: "font-semibold",
      footer: "text-xs pt-2",
    });
    // The inherited option still works, and the inherited slot keeps its classes.
    expect(wide({ size: "sm" }).root).toBe("rounded border p-2");
  });
});

describe("what the scanner has to agree with", () => {
  it("enumerates a slotted recipe's classes, and no slot-name junk", async () => {
    // The invariant, on the one shape where the scanner has to look a level deeper:
    // an option's value is a slot map, not a class value. Reading it as an `ss` map
    // emitted `root:md:p-8` — junk — while missing the `md:p-8` the runtime builds,
    // which is the silent failure this package exists to prevent.
    const { extractClasses } = await import("../../src/extract/extract.js");
    const src = `variants({
      slots: { root: { base: "rounded", dark: "border-neutral-800" }, title: "font-semibold" },
      variants: { size: { lg: { root: { base: "p-5", md: "p-8" }, title: { hover: "underline" } } } },
      compound: [{ size: "lg", class: { root: { focus: "ring-2" } } }],
    })`;
    expect(extractClasses(src)).toEqual([
      "dark:border-neutral-800",
      "focus:ring-2",
      "hover:underline",
      "md:p-8",
    ]);
  });

  it("reads the cva spellings the same as the tailess ones", async () => {
    const { extractClasses } = await import("../../src/extract/extract.js");
    const aliases = `variants({
      variants: { tone: { danger: { md: "bg-red-700" } } },
      compoundVariants: [{ tone: "danger", className: { hover: "ring-2" } }],
    })`;
    const own = `variants({
      variants: { tone: { danger: { md: "bg-red-700" } } },
      compound: [{ tone: "danger", class: { hover: "ring-2" } }],
    })`;
    expect(extractClasses(aliases)).toEqual(["hover:ring-2", "md:bg-red-700"]);
    expect(extractClasses(aliases)).toEqual(extractClasses(own));
  });
});

describe("cva's own call shape", () => {
  it("takes the base classes as a first argument", async () => {
    // With `compoundVariants` and `defaultVariants` already aliased, this was the last
    // thing that differed — so porting a cva codebase is `cva(` -> `variants(` and
    // nothing else, which is why there is no codemod to write.
    const button = variants("rounded font-medium", {
      variants: { tone: { primary: "bg-blue-600", danger: "bg-red-600" } },
      compoundVariants: [{ tone: "danger", className: "ring-2" }],
      defaultVariants: { tone: "primary" },
    });
    expect(button()).toBe("rounded font-medium bg-blue-600");
    expect(button({ tone: "danger" })).toBe("rounded font-medium bg-red-600 ring-2");
    expectTypeOf<VariantProps<typeof button>>().toEqualTypeOf<{
      tone?: "primary" | "danger" | undefined;
    }>();
  });

  it("takes an ss map as the base, which cva could not", () => {
    const t = variants({ base: "p-2", hover: "underline" } as never, {
      variants: { s: { a: "p-4" } },
    });
    expect(t({ s: "a" })).toBe("hover:underline p-4");
  });

  it("is read by the scanner the same as the config form", async () => {
    const { extractClasses } = await import("../../src/extract/extract.js");
    const cva = `variants({ base: "rounded", md: "p-6" }, { variants: { t: { a: { hover: "ring-2" } } } })`;
    const own = `variants({ base: { base: "rounded", md: "p-6" }, variants: { t: { a: { hover: "ring-2" } } } })`;
    expect(extractClasses(cva)).toEqual(["hover:ring-2", "md:p-6"]);
    expect(extractClasses(cva)).toEqual(extractClasses(own));
  });
});

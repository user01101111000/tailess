import { describe, expect, expectTypeOf, it } from "vitest";
import { type VariantComponent, type VariantProps, variants } from "../../src/utils/variants.js";

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

  it("refuses to build a flat recipe on a slotted one", () => {
    // The types say `string` for a flat recipe, so following a slotted parent would hand
    // back an object of parts — `class="[object Object]"` — and spread its options by
    // slot name, emitting `root:p-2`, a candidate matching no utility. The child's own
    // classes were dropped entirely, since a flat value has no part to spread into.
    const card = variants({
      slots: { root: "rounded", title: "font-bold" },
      variants: { size: { sm: { root: "p-2" }, lg: { root: "p-4" } } },
      defaults: { size: "sm" },
    });
    // @ts-expect-error a slotted recipe is not something a flat config may extend.
    const flat = variants({ base: "flex", variants: { tone: { a: "bg-red-500" } }, extend: card });

    const built = flat({ tone: "a" });
    expect(typeof built).toBe("string");
    expect(built).toBe("flex bg-red-500");
    expect(built).not.toContain("root:");
  });

  it("still stops at a slotted ancestor further up the chain", () => {
    const card = variants({
      slots: { root: "rounded" },
      variants: { size: { sm: { root: "p-2" } } },
    });
    const middle = variants({
      base: "flex",
      variants: { tone: { a: "text-red-500" } },
      // Through a cast, which is the only way this shape exists at all — and the reason
      // the runtime has to stop at the boundary rather than trust the declared type.
      extend: card as unknown as VariantComponent<{ tone: { a: string } }>,
    });
    const leaf = variants({
      base: "gap-2",
      variants: { edge: { hard: "rounded-none" } },
      extend: middle,
    });

    // `middle`'s own base and variants are inherited normally — only the slotted
    // grandparent is dropped, and nothing turns into a `root:` prefix on the way down.
    expect(leaf({ edge: "hard", tone: "a" })).toBe("flex gap-2 text-red-500 rounded-none");
    expect(leaf({ edge: "hard" })).not.toContain("root:");
    expect(typeof leaf({ edge: "hard" })).toBe("string");
  });
});

describe("a recipe's definition, once it is built", () => {
  it("is a snapshot, so writing to config or variants cannot change it", () => {
    // Both are declared `readonly` and were the caller's own objects. Writing to `config`
    // made a child built later inherit a definition its parent does not have — the two
    // disagree about the parent, with no error either way — and adding an option to
    // `component.variants` produced a class the runtime builds and the scanner can never
    // enumerate, which is the invariant the package is written around.
    const cfg = { base: "orig", variants: { t: { a: "A" } }, defaults: { t: "a" } } as const;
    const live = variants(cfg);
    expect(live.config).not.toBe(cfg);
    expect(Object.isFrozen(live.config)).toBe(true);
    expect(Object.isFrozen(live.variants)).toBe(true);
    expect(Object.isFrozen(live.variants.t)).toBe(true);

    // Frozen objects are silent in sloppy mode and throw in strict; either way nothing
    // takes, which is what the assertions below check rather than the throw itself.
    try {
      (live.variants.t as Record<string, string>).zzz = "SMUGGLED";
    } catch {
      /* strict mode */
    }
    expect(live({ t: "zzz" } as never)).not.toContain("SMUGGLED");
    expect(live()).toBe("orig A");
    // Both bases first, then the variants — the child inherits the parent as declared.
    expect(variants({ base: "child", variants: {}, extend: live })()).toBe("orig child A");
  });

  it("leaves the caller's own object alone", () => {
    // Freezing what was handed in would be its own surprise.
    const cfg = { base: "b", variants: { t: { a: "A" } } };
    variants(cfg);
    expect(Object.isFrozen(cfg)).toBe(false);
    cfg.base = "changed";
    expect(cfg.base).toBe("changed");
  });

  it("names an extend cycle instead of overflowing the stack", () => {
    const a = { base: "a", variants: {} } as Record<string, unknown>;
    const built = variants(a as never);
    // The snapshot is what a child reads, so this no longer closes a loop — the guard is
    // for the chain itself, which used to fail as a bare RangeError from library code.
    a.extend = built;
    expect(() => variants(a as never)).not.toThrow();
    const self = { base: "s", variants: {} } as Record<string, unknown>;
    self.extend = { config: self, variants: {} };
    expect(() => variants(self as never)).toThrow(/cycle/);
  });
});

describe("a slot or option named like an Object member", () => {
  it("keeps a `__proto__` slot's classes instead of losing them to the prototype", () => {
    // `map["__proto__"] = v` invokes the prototype setter rather than creating a key, so
    // the part vanished and the accumulator's prototype was replaced — a class the recipe
    // declares emitted nowhere, with no error.
    // Typed loosely on purpose: TypeScript will not infer the slotted overload through a
    // `__proto__` key at all, so this shape only ever arrives from JavaScript — which is
    // exactly why the runtime has to hold it.
    const card = variants({
      slots: { ["__proto__"]: "p-proto", constructor: "p-ctor", root: "p-root" },
      variants: { s: { a: { root: "r-a", ["__proto__"]: "proto-a" } } },
      defaults: { s: "a" },
    } as never) as unknown as () => Record<string, string>;
    const built = card();
    // Read through a descriptor, not `built.__proto__` — going through the accessor is
    // precisely the mistake under test, and it would report the prototype either way.
    expect(Object.hasOwn(built, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(built, "__proto__")?.value).toBe("p-proto proto-a");
    expect(built.constructor).toBe("p-ctor");
    expect(built.root).toBe("p-root r-a");
  });

  it("keeps a `__proto__` variant group", () => {
    const t = variants({
      base: "b",
      variants: { ["__proto__"]: { x: "px" }, constructor: { x: "cx" } },
      defaults: { ["__proto__"]: "x", constructor: "x" },
    });
    expect(Object.keys(t.variants).sort()).toEqual(["__proto__", "constructor"]);
    expect(t()).toBe("b px cx");
  });
});

describe("cva's one-argument call", () => {
  it("builds a component that just emits its base", () => {
    // `cva("font-semibold border rounded")` with no config is documented and common; this
    // threw `TypeError: Cannot convert undefined or null to object` from `Object.keys`,
    // naming neither tailess nor the recipe.
    const plain = variants("flex items-center");
    expect(plain()).toBe("flex items-center");
    expect(plain({}, "gap-2")).toBe("flex items-center gap-2");
    expect(variants({ base: "only" } as never)()).toBe("only");
  });
});

describe("a variant whose options are numbered", () => {
  /**
   * `{ cols: { 1: …, 2: … } }` is an ordinary recipe — a column count, a gap or an
   * elevation scale. Numeric keys leave `keyof O & string` empty, and `never` extends
   * `"true" | "false"`, so the group was classified boolean: every value the types
   * accepted did nothing, and `2` — the one that worked — was a compile error.
   */
  const grid = variants({
    base: "grid",
    variants: { cols: { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } },
  });

  it("takes the number the option is keyed by", () => {
    expect(grid({ cols: 2 })).toBe("grid grid-cols-2");
    expect(grid({ cols: 1 })).toBe("grid grid-cols-1");
  });

  it("takes the string spelling too, since that is the key itself", () => {
    // Both spellings, exactly as a boolean variant takes `true` and `"true"`.
    expect(grid({ cols: "2" })).toBe("grid grid-cols-2");
  });

  it("is not a boolean variant", () => {
    // @ts-expect-error `cols` names three options, none of them true or false.
    expect(grid({ cols: true })).toBe("grid");
    expectTypeOf<VariantProps<typeof grid>>().toEqualTypeOf<{
      cols?: 1 | "1" | 2 | "2" | 3 | "3" | undefined;
    }>();
  });

  it("treats a number exactly as it treats the string spelling of it", () => {
    const withDefault = variants({
      base: "grid",
      variants: { cols: { 1: "grid-cols-1", 2: "grid-cols-2" } },
      defaults: { cols: 1 },
    });
    // A value that names no key still names *something*, so it replaces the default and
    // contributes nothing — which is what a string that names no option already did.
    expect(withDefault({ cols: 9 as unknown as 2 })).toBe("grid");
    expect(withDefault({ cols: "9" as unknown as 2 })).toBe("grid");
    // `NaN` and the infinities name nothing at all, so the default stands.
    expect(withDefault({ cols: Number.NaN as unknown as 2 })).toBe("grid grid-cols-1");
    expect(withDefault({ cols: Number.POSITIVE_INFINITY as unknown as 2 })).toBe(
      "grid grid-cols-1",
    );
  });

  it("does not turn an empty group into a boolean one", () => {
    const future = variants({ base: "b", variants: { future: {} } });
    // @ts-expect-error the group offers nothing, so nothing selects it.
    expect(future({ future: true })).toBe("b");
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

  it("still reads a slotted recipe whose slot names are not written inline", async () => {
    // A recipe is slotted because it has a `slots` field, not because the scanner could
    // read the names out of it. Hoisted to a const or built with a spread, the names are
    // invisible while the option values are still one level deep — and reading those as
    // a flat `ss` map emitted `root:md:p-8`, junk matching no utility, in place of the
    // `md:p-8` the runtime does build.
    const { extractClasses } = await import("../../src/extract/extract.js");

    const hoisted = `const slots = { root: "rounded", title: "font-semibold" };
    variants({
      slots,
      variants: { size: { lg: { root: { md: "p-8" }, title: { md: "text-xl" } } } },
    })`;
    expect(extractClasses(hoisted)).toEqual(["md:p-8", "md:text-xl"]);

    const spread = `variants({
      slots: { ...shared, title: "font-semibold" },
      variants: { size: { lg: { root: { lg: "p-9" }, title: { lg: "text-2xl" } } } },
    })`;
    expect(extractClasses(spread)).toEqual(["lg:p-9", "lg:text-2xl"]);

    // A quoted key is the same declaration.
    const quoted = `variants({
      "slots": slotMap,
      variants: { size: { lg: { root: { md: "p-7" } } } },
    })`;
    expect(extractClasses(quoted)).toEqual(["md:p-7"]);
  });

  it("still reads a flat recipe's option values as class values", async () => {
    // The other half of the same decision: no `slots` field means the option value is a
    // class value, and descending into it would lose the map it really is.
    const { extractClasses } = await import("../../src/extract/extract.js");
    const flat = `variants({
      base: "rounded",
      variants: { size: { lg: { md: "p-8", hover: "shadow" } } },
    })`;
    expect(extractClasses(flat)).toEqual(["hover:shadow", "md:p-8"]);
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

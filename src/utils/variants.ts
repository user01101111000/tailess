import { isDev } from "../internal/env.js";
import { ownOr } from "../internal/lookup.js";
import { firstTime, warn } from "../internal/settings.js";
import type { SsArg } from "../types.js";
import { ss } from "./ss.js";

/** The options one variant offers, e.g. `{ sm: "text-sm", lg: "text-lg" }`. */
export type VariantOptions = Record<string, SsArg>;

/** Every variant a component takes, e.g. `{ tone: {…}, size: {…} }`. */
export type VariantGroups = Record<string, VariantOptions>;

/**
 * The named parts of a multi-part component, each with the classes it always gets.
 *
 * `{ root: "relative", label: "text-sm", icon: "size-4" }`. A recipe with slots has no
 * single `base`, because there is no single element — the slot map *is* the base.
 */
export type SlotDefaults = Record<string, SsArg>;

/** A per-slot value: what one variant option, or one compound rule, adds to each part. */
export type SlotValue<S extends SlotDefaults> = { -readonly [K in keyof S]?: SsArg | undefined };

/** Variant groups whose options are per-slot maps rather than flat class values. */
export type SlottedGroups<S extends SlotDefaults> = Record<string, Record<string, SlotValue<S>>>;

/**
 * Nothing, as a type that intersects cleanly.
 *
 * `X & never` is `never`, which would collapse every merged type here the moment a
 * recipe did not use `extend` — so the "no parent" default has to be the empty object.
 */
type Empty = Record<never, never>;

/** Either shape of variant group, for the parts that only ever read the option *names*. */
type AnyGroups = Record<string, Record<string, unknown>>;

/**
 * Any built recipe, loose enough that a concrete one is assignable.
 *
 * `VariantComponent<VariantGroups>` is not that: its `config` makes the type invariant,
 * so a real component would not fit where a parent is asked for.
 */
type AnyRecipe = { readonly variants: AnyGroups };
/** Any built recipe with parts. The `slots` key is what keeps the two overloads apart. */
type AnySlottedRecipe = AnyRecipe & { readonly slots: SlotDefaults };
/**
 * A recipe a flat config may build on: the same key, required absent.
 *
 * `AnyRecipe` alone is satisfied by a slotted component, which is how a flat recipe came
 * to compile as returning `string` while returning an object of parts.
 */
type FlatRecipe = AnyRecipe & { slots?: never };

/**
 * What one variant group accepts as a prop.
 *
 * A group whose options are exactly `true`/`false` is a boolean variant — `disabled`,
 * `loading`, `fullWidth` — and by far the most common kind. `cva` and `tailwind-variants`
 * both hand back `boolean` there, so a component can write
 * `<Button disabled={isDisabled}>` and forward the prop it already has. The string
 * spellings stay accepted, because the option keys really are `"true"` and `"false"` and
 * refusing them would break code written against them.
 *
 * The `never` case is guarded first because it is not a boolean variant at all. Numeric
 * option keys — `{ cols: { 1: …, 2: … } }`, a gap or elevation scale — leave
 * `keyof O & string` empty, and `never extends "true" | "false"` is *true*, so such a
 * group used to be typed boolean: every value the types accepted did nothing, and `2`,
 * the one that worked, was a compile error.
 */
/**
 * One option name, in both spellings that select it.
 *
 * A numeric key is `2` in the group and `"2"` as a property name, and the runtime looks
 * up the string — so both select it, exactly as `true` and `"true"` both do for a boolean
 * variant, and for the same reason: the key really is the string.
 */
type NameOf<K> = K extends number ? K | `${K}` : K;
type Names<O> = NameOf<keyof O & (string | number)>;
type Option<O> = [keyof O & string] extends [never]
  ? Names<O>
  : keyof O & string extends "true" | "false"
    ? boolean | (keyof O & string)
    : Names<O>;

/**
 * One optional key per variant, whose value is one of that variant's own options.
 *
 * Each is spelled `| undefined` for the same reason the plugin options are: under
 * `exactOptionalPropertyTypes` a bare optional refuses a value that may be
 * *explicitly* undefined, and `{ size: props.size }` — a component forwarding an
 * optional prop it did not receive — is precisely that. The runtime already treats it
 * as "leave the default alone", so the type has to let it through.
 */
type PropsOf<V extends AnyGroups> = {
  // `-readonly` because `variants` infers its config `const`, and a component's own
  // props type should not inherit that: `VariantProps<typeof button>` is something a
  // caller builds objects of, not a view of the recipe.
  -readonly [K in keyof V]?: Option<V[K]> | undefined;
};

/**
 * Which variants a compound rule requires.
 *
 * A value may be a list, which is what makes "ring on danger *or* warning" one rule
 * rather than two that have to be kept in step by hand — the count is multiplicative
 * otherwise. `cva` and `tv` both take a list here.
 */
type CompoundMatch<V extends AnyGroups> = {
  -readonly [K in keyof V]?: Option<V[K]> | ReadonlyArray<Option<V[K]>> | undefined;
};

/** One rule in `compound`: the match, plus the classes it contributes. */
export type CompoundRule<V extends AnyGroups, C = SsArg> = CompoundMatch<V> & {
  /** The classes this rule adds. `className` is accepted as an alias. */
  class?: C;
  className?: C;
};

/**
 * The props a built component accepts. A typo in either half is a compile error.
 *
 * Takes the component itself — `VariantProps<typeof button>`, the spelling every
 * `cva`-shaped library uses — or the variant groups directly, since a config written
 * apart from the call has no component to point at yet.
 */
export type VariantProps<T> = T extends { variants: infer V extends AnyGroups }
  ? PropsOf<V>
  : T extends AnyGroups
    ? PropsOf<T>
    : never;

/**
 * What {@link variants} is given.
 *
 * `compoundVariants` and `defaultVariants` are accepted as aliases for `compound` and
 * `defaults`, so a `cva` or `tailwind-variants` recipe ports by changing nothing but the
 * function name. Give both spellings of one and the tailess name wins.
 */
export interface VariantsConfig<V extends VariantGroups> {
  /** Classes every instance gets, before any variant applies. */
  base?: SsArg;
  /** The variants themselves. */
  variants: V;
  /** Extra classes for a *combination* of variants, applied after the singles. */
  compound?: ReadonlyArray<CompoundRule<V>>;
  /** `cva` / `tailwind-variants` spelling of {@link VariantsConfig.compound}. */
  compoundVariants?: ReadonlyArray<CompoundRule<V>>;
  /** What each variant is when the caller does not say. */
  defaults?: PropsOf<V>;
  /** `cva` / `tailwind-variants` spelling of {@link VariantsConfig.defaults}. */
  defaultVariants?: PropsOf<V>;
  /**
   * A recipe to build on. Its base, variants, compounds and defaults come first, and
   * anything declared here wins — per option, not per group, so adding one `tone` does
   * not drop the ones inherited.
   *
   * A *slotted* recipe is not one of these. Extending one from a flat config switches
   * what the built component returns — an object of parts, where the declared type still
   * says `string` — and drops every class the child declares, because a flat option value
   * has no part to spread into. Declare `slots` here too and the slotted overload applies.
   */
  extend?: FlatRecipe;
}

/** What {@link variants} is given when the component has named parts. */
export interface SlottedConfig<S extends SlotDefaults, V extends SlottedGroups<S>> {
  /** The parts, each with the classes it always gets. Replaces `base`. */
  slots: S;
  /** The variants themselves; every option says what it adds to each part. */
  variants: V;
  compound?: ReadonlyArray<CompoundRule<V, SlotValue<S>>>;
  compoundVariants?: ReadonlyArray<CompoundRule<V, SlotValue<S>>>;
  defaults?: PropsOf<V>;
  defaultVariants?: PropsOf<V>;
  /** A slotted recipe to build on. Its slots and variants are merged, then overridden. */
  extend?: AnySlottedRecipe;
}

/** A component built by {@link variants}. */
export interface VariantComponent<V extends VariantGroups> {
  (props?: PropsOf<V>, ...rest: SsArg[]): string;
  /**
   * The variants it was built from, kept so `VariantProps<typeof button>` has
   * something to read the option names back out of — and useful in its own right for
   * anything that has to enumerate them, a story or a docs table.
   */
  readonly variants: V;
  /** The config it was built from, which is what makes `extend` possible. */
  readonly config: unknown;
}

/** A multi-part component built by {@link variants}: one class string per slot. */
export interface SlottedComponent<V extends AnyGroups, S extends SlotDefaults> {
  (props?: PropsOf<V>, extra?: SlotValue<S>): { -readonly [K in keyof S]: string };
  readonly variants: V;
  readonly slots: S;
  readonly config: unknown;
}

/**
 * The option key a prop value names.
 *
 * A boolean variant's options really are keyed `"true"` and `"false"`, so a `boolean`
 * prop — which is what a component already has, and what `cva` and `tv` hand back — has
 * to become the string before the lookup.
 */
function optionKey(value: unknown): string | undefined {
  if (typeof value === "boolean") return String(value);
  // A numeric option key is spelled `2` at the call site and `"2"` in the group, so the
  // number has to become the string too. `NaN` and the infinities name no key and are
  // left to fall through to the default, which is what they did before.
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  return typeof value === "string" ? value : undefined;
}

/** Slot sets already reported, so a recipe built in a render loop warns once. */
const warnedFlatExtends = new Set<string>();

/**
 * Warn that a flat recipe extended a slotted one, and what was dropped.
 *
 * Only reachable through a cast or an untyped boundary — {@link FlatRecipe} refuses it —
 * but that is exactly where it was silent before: the built component returned an object
 * of parts while its type said `string`, so React rendered `class="[object Object]"` and
 * `.split()` on the value threw.
 */
function warnFlatExtendsSlotted(slots: string[]): void {
  const named = slots.join(", ");
  if (!firstTime(warnedFlatExtends, named)) return;
  warn(
    `variants(): this recipe extends a slotted one (${named}) but declares no slots of ` +
      `its own, so there is nothing to spread the inherited parts into. The parent's slot ` +
      `classes are ignored and this stays a flat component. Declare slots here too, or ` +
      `extend a recipe without them.`,
  );
}

/** True when a compound rule's requirement — one option, or a list — is satisfied. */
function rulePicks(wanted: unknown, chosen: string | undefined): boolean {
  if (Array.isArray(wanted)) return wanted.some((one) => optionKey(one) === chosen);
  return optionKey(wanted) === chosen;
}

/** The shape the runtime actually walks, with both spellings already resolved. */
interface Resolved {
  /** Kept as a list, not wrapped in one: an object *inside* an array is a clsx
   *  dictionary to `ss`, so an inherited base map would come out as its own keys. */
  base: SsArg[];
  slots?: Record<string, SsArg[]>;
  variants: Record<string, Record<string, unknown>>;
  compound: ReadonlyArray<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  /** Slot names on an ancestor a flat recipe could not inherit; see {@link resolve}. */
  skippedSlots?: string[];
}

/**
 * Read a config down to one shape, following `extend` first so the child overrides.
 *
 * `wantSlots` is whether the recipe being built has slots of its own, and it decides
 * where the chain stops. A flat recipe cannot inherit from a slotted one: its options are
 * flat class values with no part to spread into, so following that parent hands back an
 * object of parts where the caller declared a `string` — React renders
 * `class="[object Object]"` — and spreads the parent's option values by their slot names,
 * emitting `root:p-2` and other prefixes that match no utility. {@link FlatRecipe} refuses
 * the shape at compile time; this is what happens when a cast gets it through anyway.
 */
function resolve(config: Record<string, unknown>, wantSlots: boolean): Resolved {
  const parent = config.extend as { config?: Record<string, unknown> } | undefined;
  const parentConfig = parent?.config;
  const parentSlots = parentConfig?.slots as Record<string, SsArg> | undefined;
  const skipped = !wantSlots && parentSlots !== undefined ? Object.keys(parentSlots) : undefined;
  const from: Resolved =
    parentConfig && !skipped
      ? resolve(parentConfig, wantSlots)
      : { base: [], variants: {}, compound: [], defaults: {} };

  const own = config.variants as Record<string, Record<string, unknown>>;
  // Merged per *option*, not per group: a child adding one `tone` must not drop the
  // ones it inherited, which is the whole reason to extend rather than copy.
  const merged: Record<string, Record<string, unknown>> = { ...from.variants };
  for (const group of Object.keys(own)) {
    merged[group] = { ...from.variants[group], ...own[group] };
  }

  const slots = config.slots as Record<string, SsArg> | undefined;
  const ownCompound = (config.compound ?? config.compoundVariants ?? []) as ReadonlyArray<
    Record<string, unknown>
  >;
  const ownDefaults = (config.defaults ?? config.defaultVariants ?? {}) as Record<string, unknown>;

  const inherited = skipped ?? from.skippedSlots;
  return {
    base: [...from.base, config.base as SsArg],
    ...(slots || from.slots ? { slots: mergeSlots(from.slots, slots) } : {}),
    variants: merged,
    compound: [...from.compound, ...ownCompound],
    defaults: { ...from.defaults, ...ownDefaults },
    ...(inherited ? { skippedSlots: inherited } : {}),
  };
}

/** Concatenate two slot maps, so an inherited part keeps its classes and gains more. */
function mergeSlots(
  from: Record<string, SsArg[]> | undefined,
  own: Record<string, SsArg> | undefined,
): Record<string, SsArg[]> {
  const out: Record<string, SsArg[]> = {};
  for (const name of new Set([...Object.keys(from ?? {}), ...Object.keys(own ?? {})])) {
    out[name] = [...(from?.[name] ?? []), own?.[name]];
  }
  return out;
}

/**
 * The parent's variant groups, read off whatever was passed as `extend`.
 *
 * Inferring a parent type parameter directly does not work: with `extend` absent there
 * is nothing to infer from, and TypeScript falls back to the *constraint* rather than
 * the default — so `V & VariantGroups` leaked a string index signature into the props
 * of every recipe that did not extend anything. Reading it back out of the component
 * type keeps the "no parent" case exactly `V`.
 */
type Inherited<E> = E extends { variants: infer P extends AnyGroups } ? P : Empty;
/** The parent's slots, read the same way. */
type InheritedSlots<E> = E extends { slots: infer P extends SlotDefaults } ? P : Empty;

/**
 * Every slot name from both recipes.
 *
 * A plain intersection would not do: two recipes that both declare `root` give it
 * `"border" & "rounded"`, which is `never`, and the part disappears from the result.
 * Only the *names* matter downstream, so the values are widened.
 */
type MergedSlots<A extends SlotDefaults, B extends SlotDefaults> = {
  [K in keyof A | keyof B]: SsArg;
};

export function variants<
  const S extends SlotDefaults,
  const V extends SlottedGroups<S>,
  const E extends AnySlottedRecipe | undefined = undefined,
>(
  config: SlottedConfig<S, V> & { extend?: E },
): SlottedComponent<V & Inherited<E>, MergedSlots<S, InheritedSlots<E>>>;
export function variants<
  const V extends VariantGroups,
  const E extends AnyRecipe | undefined = undefined,
>(config: VariantsConfig<V> & { extend?: E }): VariantComponent<V & Inherited<E>>;
/**
 * `cva`'s own call shape: the base classes first, everything else second.
 *
 * With `compoundVariants` and `defaultVariants` already accepted as aliases, this is
 * the last thing that differed — so porting a `cva` codebase is `cva(` → `variants(`
 * and nothing else, which is why there is no codemod to write.
 */
export function variants<
  const V extends VariantGroups,
  const E extends AnyRecipe | undefined = undefined,
>(
  base: SsArg,
  config: Omit<VariantsConfig<V>, "base"> & { extend?: E },
): VariantComponent<V & Inherited<E>>;

/**
 * Build a component's `className` from a set of typed variants.
 *
 * The shape a `cva`-style recipe has, with one difference that matters here: every
 * value is an {@link SsArg}, so a variant option can be an `ss` map rather than a flat
 * string. That is what lets a variant carry breakpoints and states of its own —
 * `lg: { base: "text-lg", md: "px-6" }` — which a plain string cannot express and
 * which is exactly what tailess is for.
 *
 * Emission order is `base`, then each variant in the order it was declared, then the
 * compound rules, then whatever the caller passed. Later wins, as everywhere else, so
 * a trailing `className` still overrides — see {@link cn}.
 *
 * Declare `slots` instead of `base` and it builds a *multi-part* component: every
 * option says what it adds to each named part, and the call returns one class string
 * per part rather than one string.
 *
 * @example
 * const button = variants({
 *   base: { base: "rounded font-medium", hover: "brightness-110" },
 *   variants: {
 *     tone: { primary: "bg-blue-600", danger: "bg-red-600" },
 *     size: { sm: "text-sm px-2", lg: { base: "text-lg px-4", md: "px-6" } },
 *   },
 *   compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
 *   defaults: { tone: "primary", size: "sm" },
 * });
 *
 * button();                            // the defaults
 * button({ size: "lg" });              // => "… text-lg px-4 md:px-6"
 * button({ tone: "danger" }, className);
 *
 * @example
 * const card = variants({
 *   slots: { root: "rounded-lg border", title: "font-semibold", body: "text-sm" },
 *   variants: {
 *     size: {
 *       sm: { root: "p-3", title: "text-base" },
 *       lg: { root: { base: "p-5", md: "p-8" }, title: "text-xl" },
 *     },
 *   },
 *   defaults: { size: "sm" },
 * });
 *
 * const { root, title, body } = card({ size: "lg" });
 */
// The two overloads above are the contract; this signature only has to be wide enough
// to serve both, which no shared type would be without giving up on either.
// biome-ignore lint/suspicious/noExplicitAny: an implementation signature, never called
export function variants(first: any, second?: any): any {
  // `cva`'s shape: base classes first, config second. A config object always has
  // `variants`; a base value never does, so the two cannot be confused.
  const config = second === undefined ? first : { ...second, base: first };
  const resolved = resolve(config, config.slots !== undefined);
  if (isDev && resolved.skippedSlots) warnFlatExtendsSlotted(resolved.skippedSlots);
  const groups = resolved.variants;
  const names = Object.keys(groups);
  const slots = resolved.slots;

  /** The option each variant resolves to for one call, defaults included. */
  const pick = (props?: Record<string, unknown>): Record<string, string | undefined> => {
    // Spread would let an explicitly-`undefined` prop erase a default, and
    // `{ size: undefined }` is what a component writes when it forwards an optional
    // prop it did not receive.
    const chosen: Record<string, string | undefined> = {};
    for (const name of Object.keys(resolved.defaults)) {
      chosen[name] = optionKey(resolved.defaults[name]);
    }
    if (props) {
      for (const name of Object.keys(props)) {
        const key = optionKey(props[name]);
        if (key !== undefined) chosen[name] = key;
      }
    }
    return chosen;
  };

  /** Every compound rule this call satisfies, in declaration order. */
  const matching = (chosen: Record<string, string | undefined>): unknown[] => {
    const out: unknown[] = [];
    for (const rule of resolved.compound) {
      let matched = true;
      for (const name of names) {
        const wanted = rule[name];
        if (wanted !== undefined && !rulePicks(wanted, chosen[name])) {
          matched = false;
          break;
        }
      }
      if (matched) out.push(rule.class ?? rule.className);
    }
    return out;
  };

  if (slots) {
    const slotNames = Object.keys(slots);
    const component = (props?: Record<string, unknown>, extra?: Record<string, SsArg>) => {
      const chosen = pick(props);
      const parts: Record<string, SsArg[]> = {};
      for (const slot of slotNames) parts[slot] = [...(slots[slot] as SsArg[])];

      /** Spread one per-slot value across the parts it names. */
      const spread = (value: unknown): void => {
        if (typeof value !== "object" || value === null) return;
        const map = value as Record<string, SsArg>;
        for (const slot of slotNames) {
          (parts[slot] as SsArg[]).push(ownOr<SsArg>(map, slot, undefined));
        }
      };

      for (const name of names) {
        const value = chosen[name];
        if (value === undefined) continue;
        // `ownOr` rather than an index read, so an option named `toString` or
        // `constructor` cannot pull something off the prototype and into a className.
        spread(ownOr<unknown>(groups[name] as Record<string, unknown>, value, undefined));
      }
      for (const rule of matching(chosen)) spread(rule);
      if (extra) spread(extra);

      const out: Record<string, string> = {};
      for (const slot of slotNames) out[slot] = ss(...(parts[slot] as SsArg[]));
      return out;
    };
    return Object.assign(component, { variants: groups, slots, config });
  }

  const component = (props?: Record<string, unknown>, ...rest: SsArg[]): string => {
    const chosen = pick(props);
    const parts: SsArg[] = [...resolved.base];
    for (const name of names) {
      const value = chosen[name];
      if (value === undefined) continue;
      parts.push(ownOr<SsArg>(groups[name] as Record<string, SsArg>, value, undefined));
    }
    for (const rule of matching(chosen)) parts.push(rule as SsArg);
    return ss(...parts, ...rest);
  };

  return Object.assign(component, { variants: groups, config });
}

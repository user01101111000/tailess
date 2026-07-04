import type { ClassValue } from "clsx";
import type { defaultScreens, defaultStates } from "../config/defaults.js";
import { resolveConfig } from "../config/resolve.js";
import type { ResolvedConfig, TailessConfig } from "../config/types.js";
import { aria, data } from "../utils/attrs.js";
import { cn } from "../utils/cn.js";
import { match } from "../utils/match.js";
import { on } from "../utils/on.js";
import { between, until } from "../utils/range.js";
import { responsive } from "../utils/responsive.js";
import { ss } from "../utils/ss.js";

/**
 * Keep only literal keys, dropping a `string`/`number` index signature. Without
 * this, `"sm" | "md" | ... | string` collapses to `string` and every helper
 * loses its autocomplete — which is exactly what happens for the default
 * instance, whose config type is the wide `Record<string, string>`.
 */
type LiteralKeys<T> = keyof {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

/** Breakpoint keys available for a given config: the defaults plus custom keys. */
type ScreenKey<C extends TailessConfig> =
  | keyof typeof defaultScreens
  | LiteralKeys<NonNullable<C["screens"]>>;

/** State keys available for a given config: the defaults plus custom keys. */
type StateKey<C extends TailessConfig> =
  | keyof typeof defaultStates
  | LiteralKeys<NonNullable<C["states"]>>;

/** Object accepted by an instance's `ss()`, with keys typed from the config. */
type SsInput<C extends TailessConfig> = { base?: ClassValue } & Partial<
  Record<ScreenKey<C> | StateKey<C>, ClassValue>
>;

/**
 * A `tailess` instance: helper functions bound to a resolved config, so the
 * breakpoint/state keys you declared are type-safe at every call site.
 */
export interface Tailess<C extends TailessConfig = TailessConfig> {
  /** The fully-resolved config powering this instance (screens, states, base). */
  readonly config: ResolvedConfig;
  /**
   * Conditionally join class names (via `clsx`) and resolve Tailwind conflicts
   * (via `tailwind-merge`), so the last utility in a conflicting group wins. This
   * instance's `config.base` is always prepended, making it the place to inject
   * shared design-system tokens.
   *
   * @example
   * const st = createTailess({ base: "antialiased" });
   * st.cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
   * // => "antialiased py-1 bg-blue-500 px-4"  (px-2 dropped, base prepended)
   */
  cn: (...inputs: ClassValue[]) => string;
  /**
   * Group Tailwind classes by breakpoint/state in a readable object instead of
   * interleaving prefixes inside a string. Each key is one of this instance's
   * configured breakpoints or states (plus `base` for unprefixed classes), so
   * every key is autocompleted and typo-checked at the call site.
   *
   * Order: `base` first, then breakpoints in config order, then states; the
   * instance's `config.base` is always prepended. Conflicting utilities within
   * the same prefix are merged via `cn` (tailwind-merge).
   *
   * @example
   * const st = createTailess({ screens: { "3xl": "1600px" } });
   * st.ss({ base: "flex text-sm", md: "text-base", "3xl": "text-2xl" });
   * // => "flex text-sm md:text-base 3xl:text-2xl"
   */
  ss: (input: SsInput<C>) => string;
  /**
   * Build a mobile-first responsive class string from a `base` value plus
   * per-breakpoint overrides. Breakpoints are emitted in this instance's
   * `config.screens` order and merged via `cn`. Breakpoint keys are typed from
   * config, so custom keys autocomplete and typos fail at compile time.
   *
   * @example
   * const st = createTailess({ screens: { "3xl": "1600px" } });
   * st.responsive("text-sm", { md: "text-lg", "3xl": "text-2xl" });
   * // => "text-sm md:text-lg 3xl:text-2xl"
   */
  responsive: (base: ClassValue, variants?: Partial<Record<ScreenKey<C>, ClassValue>>) => string;
  /**
   * Prefix classes with one or more configured state variants. State keys resolve
   * through `config.states`, so aliases (e.g. `groupHover` -> `group-hover`) work.
   * Passing an array stacks the variants in order to express compound variants
   * like `dark:hover:`. Keys are typed from config.
   *
   * @example
   * st.on("hover", "bg-blue-600 text-white"); // => "hover:bg-blue-600 hover:text-white"
   * st.on(["dark", "hover"], "bg-black");     // => "dark:hover:bg-black"
   */
  on: (state: StateKey<C> | StateKey<C>[], classes: ClassValue) => string;
  /**
   * Apply classes only *below* a breakpoint, using Tailwind's `max-*` variant —
   * the complement of {@link Tailess.responsive} (which is min-width). The
   * breakpoint key is typed from config.
   *
   * @example
   * st.until("md", "hidden"); // => "max-md:hidden"  (applies below the md breakpoint)
   */
  until: (key: ScreenKey<C>, classes: ClassValue) => string;
  /**
   * Apply classes only *between* two breakpoints (inclusive of `min`, exclusive of
   * `max`), by combining a min-width variant with a `max-*` variant. Both keys are
   * typed from config.
   *
   * @example
   * st.between("sm", "lg", "block"); // => "sm:max-lg:block"  (sm up to, not including, lg)
   */
  between: (min: ScreenKey<C>, max: ScreenKey<C>, classes: ClassValue) => string;
  /**
   * Pick a class value from a lookup keyed by a discriminant (a variant prop,
   * size, tone...). `options` must cover every possible value of `key`, so the
   * mapping is exhaustive at compile time; an unmatched `key` at runtime falls
   * back to `fallback` (or `""`). The result runs through `cn`.
   *
   * @example
   * st.match(size, { sm: "text-sm", md: "text-base", lg: "text-lg" });
   * // size === "md" => "text-base"
   * st.match(tone, { primary: "bg-blue-600", danger: "bg-red-600" }, "bg-gray-200");
   */
  match: <K extends string>(
    key: K,
    options: Record<K, ClassValue>,
    fallback?: ClassValue,
  ) => string;
  /**
   * Prefix classes with a `data-*` attribute variant. Pass a `value` for the
   * `data-[name=value]:` form (common with headless UI libraries like Radix), or
   * pass `null`/`undefined` for the attribute-presence form `data-[name]:`.
   *
   * @example
   * st.data("state", "open", "opacity-100");      // => "data-[state=open]:opacity-100"
   * st.data("disabled", null, "pointer-events-none"); // => "data-[disabled]:pointer-events-none"
   */
  data: (
    name: string,
    value: string | number | boolean | null | undefined,
    classes: ClassValue,
  ) => string;
  /**
   * Prefix classes with an `aria-*` attribute variant, e.g. `aria-expanded:`,
   * `aria-selected:`, `aria-checked:`.
   *
   * @example
   * st.aria("expanded", "rotate-180"); // => "aria-expanded:rotate-180"
   */
  aria: (name: string, classes: ClassValue) => string;
}

/**
 * Create a configured `tailess` instance. Every key you add to `screens` or
 * `states` becomes a valid, autocompleted argument to the returned helpers.
 *
 * @example
 * const st = createTailess({ screens: { "3xl": "1600px" } });
 * st.ss({ base: "text-sm", "3xl": "text-2xl" }); // fully typed
 */
export function createTailess<const C extends TailessConfig>(userConfig?: C): Tailess<C> {
  const config = resolveConfig(userConfig);

  return {
    config,
    cn: (...inputs) => cn(config.base, ...inputs),
    ss: (input) => ss(config, { ...input, base: [config.base, input.base] }),
    responsive: (base, variants) =>
      responsive(config, base, variants as Record<string, ClassValue>),
    on: (state, classes) => on(config, state as string | string[], classes),
    until: (key, classes) => until(config, key as string, classes),
    between: (min, max, classes) => between(config, min as string, max as string, classes),
    match: (key, options, fallback) => match(key, options, fallback),
    data: (name, value, classes) => data(name, value, classes),
    aria: (name, classes) => aria(name, classes),
  };
}

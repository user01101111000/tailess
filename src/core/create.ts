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
  /** The fully-resolved config powering this instance. */
  readonly config: ResolvedConfig;
  /** Join + Tailwind-merge class names, prepending `config.base`. */
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
  /** Build a mobile-first responsive class string. Keys are typed from config. */
  responsive: (base: ClassValue, variants?: Partial<Record<ScreenKey<C>, ClassValue>>) => string;
  /** Prefix classes with one or more configured state variants. Keys are typed from config. */
  on: (state: StateKey<C> | StateKey<C>[], classes: ClassValue) => string;
  /** Apply classes below a breakpoint (`max-*`). Keys are typed from config. */
  until: (key: ScreenKey<C>, classes: ClassValue) => string;
  /** Apply classes between two breakpoints (inclusive min, exclusive max). Keys typed from config. */
  between: (min: ScreenKey<C>, max: ScreenKey<C>, classes: ClassValue) => string;
  /** Pick a class from a lookup keyed by a variant prop. Exhaustive at compile time. */
  match: <K extends string>(
    key: K,
    options: Record<K, ClassValue>,
    fallback?: ClassValue,
  ) => string;
  /** Prefix classes with a `data-*` attribute variant. */
  data: (
    name: string,
    value: string | number | boolean | null | undefined,
    classes: ClassValue,
  ) => string;
  /** Prefix classes with an `aria-*` attribute variant. */
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

/**
 * Tailwind's built-in breakpoints, mobile-first. Values mirror Tailwind v4's
 * defaults (`--breakpoint-*`), which are expressed in `rem`:
 * `sm` 40rem/640px, `md` 48rem/768px, `lg` 64rem/1024px, `xl` 80rem/1280px,
 * `2xl` 96rem/1536px.
 */
export const screenKeys = ["sm", "md", "lg", "xl", "2xl"] as const;

/** A built-in Tailwind breakpoint key. */
export type ScreenKey = (typeof screenKeys)[number];

/**
 * Breakpoint key -> min-width, handy for matching a CSS breakpoint from JS:
 *
 * @example
 * window.matchMedia(`(min-width: ${screens.md})`).matches;
 */
export const screens: Readonly<Record<ScreenKey, string>> = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
};

/**
 * `max-*` breakpoint keys, largest first — the order Tailwind itself emits
 * max-width variants in, so a narrower range wins over a wider one.
 */
export const maxScreenKeys = ["max-2xl", "max-xl", "max-lg", "max-md", "max-sm"] as const;

/** A `max-*` breakpoint key, e.g. `max-md` (below the `md` breakpoint). */
export type MaxScreenKey = (typeof maxScreenKeys)[number];

/**
 * Every Tailwind variant that needs no value of its own — pseudo-classes,
 * pseudo-elements, media queries, and the static `group-*` / `peer-*` pairs.
 *
 * Variants that take a value (`data-*`, `aria-*`, `supports-*`, `has-*`, `not-*`,
 * `min-*`/`max-*` with an arbitrary length, …) are not listed: use the
 * {@link data} / {@link aria} helpers, or `withPrefix` for anything else.
 *
 * Every entry here is verified against Tailwind's compiler in the test suite, so
 * an autocompleted key always resolves to a real variant.
 */
export const stateKeys = [
  // Pseudo-classes
  "hover",
  "focus",
  "focus-within",
  "focus-visible",
  "active",
  "visited",
  "target",
  "first",
  "last",
  "only",
  "odd",
  "even",
  "first-of-type",
  "last-of-type",
  "only-of-type",
  "empty",
  "disabled",
  "enabled",
  "checked",
  "indeterminate",
  "default",
  "optional",
  "required",
  "valid",
  "invalid",
  "user-valid",
  "user-invalid",
  "in-range",
  "out-of-range",
  "placeholder-shown",
  "details-content",
  "autofill",
  "read-only",

  // Pseudo-elements
  "before",
  "after",
  "first-letter",
  "first-line",
  "marker",
  "selection",
  "file",
  "backdrop",
  "placeholder",

  // Media & feature queries
  "dark",
  "motion-safe",
  "motion-reduce",
  "contrast-more",
  "contrast-less",
  "forced-colors",
  "inverted-colors",
  "portrait",
  "landscape",
  "print",
  "noscript",
  "pointer-fine",
  "pointer-coarse",
  "pointer-none",
  "any-pointer-fine",
  "any-pointer-coarse",
  "any-pointer-none",

  // Direction & element state
  "rtl",
  "ltr",
  "open",
  "inert",
  "starting",

  // Parent state (`group`)
  "group-hover",
  "group-focus",
  "group-focus-within",
  "group-focus-visible",
  "group-active",
  "group-disabled",
  "group-checked",
  "group-open",
  "group-first",
  "group-last",
  "group-odd",
  "group-even",

  // Sibling state (`peer`)
  "peer-hover",
  "peer-focus",
  "peer-focus-within",
  "peer-focus-visible",
  "peer-active",
  "peer-disabled",
  "peer-checked",
  "peer-open",
  "peer-invalid",
  "peer-required",
  "peer-placeholder-shown",
] as const;

/** A built-in Tailwind state variant key. */
export type StateKey = (typeof stateKeys)[number];

/** Every key {@link ss} accepts besides `base`. */
export type SsKey = ScreenKey | MaxScreenKey | StateKey;

/**
 * Emission order for {@link ss}: `base`, then breakpoints mobile-first, then
 * `max-*` largest-first, then states. Keeping it stable means the same input
 * always produces the same string, which keeps `tailwind-merge`'s "last one
 * wins" behaviour predictable.
 */
const order = new Map<string, number>();
for (const key of ["base", ...screenKeys, ...maxScreenKeys, ...stateKeys]) {
  order.set(key, order.size);
}

/** Rank of a known {@link ss} key, or `undefined` if the key is not built in. */
export function rankOf(key: string): number | undefined {
  return order.get(key);
}

/** Rank given to keys that aren't built in, so they sort after every known key. */
export const unknownRank = order.size;

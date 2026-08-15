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
 * Variants describing the state of the element itself — the ones Tailwind also
 * lets you compound onto a parent (`group-*`) or a sibling (`peer-*`).
 *
 * This list is the single source of both compound families below. Writing the
 * three out by hand is how they drift: Tailwind compounds `group` and `peer`
 * with exactly the same set, so any name present in one and missing from the
 * other was an oversight, never a rule.
 */
const elementStates = [
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
  "autofill",
  "read-only",
  "open",
  "inert",
  "rtl",
  "ltr",
] as const;

/**
 * Static variants that describe something other than the element's own state —
 * pseudo-elements, media and feature queries, and the child combinators. None of
 * these compound with `group-*` / `peer-*`.
 */
const standaloneStates = [
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
  "details-content",

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
  "starting",

  // Children: `*` for direct children, `**` for all descendants.
  "*",
  "**",
] as const;

/** A state variant that also has `group-*` and `peer-*` forms. */
export type ElementStateKey = (typeof elementStates)[number];

/** A static variant with no `group-*` / `peer-*` form. */
export type StandaloneStateKey = (typeof standaloneStates)[number];

/** A parent-state variant, e.g. `group-hover`. */
export type GroupStateKey = `group-${ElementStateKey}`;

/** A sibling-state variant, e.g. `peer-checked`. */
export type PeerStateKey = `peer-${ElementStateKey}`;

/** A built-in Tailwind state variant key. */
export type StateKey = ElementStateKey | StandaloneStateKey | GroupStateKey | PeerStateKey;

/**
 * Every Tailwind variant that needs no value of its own — pseudo-classes,
 * pseudo-elements, media queries, the child combinators, and the static
 * `group-*` / `peer-*` pairs.
 *
 * Variants that take a value (`data-*`, `aria-*`, `supports-*`, `has-*`, `not-*`,
 * `in-*`, `min-*`/`max-*` with an arbitrary length, …) are not listed: use the
 * {@link data} / {@link aria} helpers, or `withPrefix` for anything else.
 *
 * The test suite enumerates Tailwind's own variant registry and asserts this list
 * matches it exactly — in both directions — so an autocompleted key always
 * resolves to a real variant, and a real variant is never missing from
 * autocomplete.
 */
export const stateKeys: readonly StateKey[] = [
  ...elementStates,
  ...standaloneStates,
  ...elementStates.map((state): GroupStateKey => `group-${state}`),
  ...elementStates.map((state): PeerStateKey => `peer-${state}`),
];

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

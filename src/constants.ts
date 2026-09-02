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
 * Container-query keys, smallest first — `@md:` styles an element by the width of
 * its nearest `@container` ancestor rather than the viewport.
 *
 * Sizes mirror Tailwind v4's `--container-*` scale. A *named* container
 * (`@lg/sidebar:`) carries a value of its own and so is not a key; write that one
 * with `withPrefix("@lg/sidebar", …)`.
 */
const containerSizes = [
  "3xs",
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
] as const;

/** A container-query key, e.g. `@md` (at the `md` container width and up). */
export type ContainerKey = `@${(typeof containerSizes)[number]}`;

/** A `@max-*` container key, e.g. `@max-md` (below the `md` container width). */
export type MaxContainerKey = `@max-${(typeof containerSizes)[number]}`;

export const containerKeys: readonly ContainerKey[] = containerSizes.map(
  (size): ContainerKey => `@${size}`,
);

/**
 * `@max-*` container keys, largest first — the same ordering rule as
 * {@link maxScreenKeys}, so a narrower range wins over a wider one.
 */
export const maxContainerKeys: readonly MaxContainerKey[] = [...containerSizes]
  .reverse()
  .map((size): MaxContainerKey => `@max-${size}`);

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
const pseudoElements = [
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
] as const;

/**
 * Media and feature queries. Split out from the rest because these are exactly the
 * standalone variants Tailwind lets you negate — `not-dark`, `not-print` — while a
 * pseudo-element or a child combinator has nothing to negate.
 */
const mediaQueries = [
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
] as const;

/** Everything standalone that is neither a pseudo-element nor a query. */
const otherStandalone = [
  "starting",

  // Children: `*` for direct children, `**` for all descendants.
  "*",
  "**",
] as const;

const standaloneStates = [...pseudoElements, ...mediaQueries, ...otherStandalone] as const;

/** A state variant that also has `group-*` and `peer-*` forms. */
export type ElementStateKey = (typeof elementStates)[number];

/** A static variant with no `group-*` / `peer-*` form. */
export type StandaloneStateKey = (typeof standaloneStates)[number];

/** A parent-state variant, e.g. `group-hover`. */
export type GroupStateKey = `group-${ElementStateKey}`;

/** A sibling-state variant, e.g. `peer-checked`. */
export type PeerStateKey = `peer-${ElementStateKey}`;

/**
 * The variants Tailwind lets you negate. Wider than the `group-*` / `peer-*` set:
 * a media query can be negated (`not-dark`) and so can a breakpoint (`not-md`,
 * which is `max-md` said the other way round), while a pseudo-element cannot.
 */
const negatableStates = [...elementStates, ...mediaQueries, ...screenKeys] as const;

/** A variant that has a `not-*` form. */
export type NegatableStateKey = (typeof negatableStates)[number];

/** A negated variant, e.g. `not-hover` or `not-dark`. */
export type NotStateKey = `not-${NegatableStateKey}`;

/** A built-in Tailwind state variant key. */
export type StateKey =
  | ElementStateKey
  | StandaloneStateKey
  | GroupStateKey
  | PeerStateKey
  | NotStateKey;

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
  ...negatableStates.map((state): NotStateKey => `not-${state}`),
];

/** Every key {@link ss} accepts besides `base`. */
export type SsKey = ScreenKey | MaxScreenKey | ContainerKey | MaxContainerKey | StateKey;

/**
 * Emission order for {@link ss}: `base`, then breakpoints mobile-first, then
 * `max-*` largest-first, then container queries the same way round, then states.
 * Keeping it stable means the same input always produces the same string, which
 * keeps `tailwind-merge`'s "last one wins" behaviour predictable.
 */
const order = new Map<string, number>();
for (const key of [
  "base",
  ...screenKeys,
  ...maxScreenKeys,
  ...containerKeys,
  ...maxContainerKeys,
  ...stateKeys,
]) {
  order.set(key, order.size);
}

/** Rank of a known {@link ss} key, or `undefined` if the key is not built in. */
export function rankOf(key: string): number | undefined {
  return order.get(key);
}

/** Rank given to keys that aren't built in, so they sort after every known key. */
export const unknownRank = order.size;

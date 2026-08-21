import type { ClassValue } from "clsx";
import type { ScreenKey, SsKey } from "./constants.js";

export type { ClassValue };

/**
 * Anything {@link ss} accepts — both as a top-level argument and as a bucket
 * value. The two are deliberately the same set, so a nested group reads exactly
 * like the outer one.
 *
 * - a class string, or a `clsx`-style array, becomes classes;
 * - a falsy value drops whatever it stood for, prefix included;
 * - a plain object is an {@link SsInput} map, which stacks the prefix.
 *
 * A bare `clsx` dictionary is deliberately *not* in the union. `{ "text-lg": on }`
 * and `{ hover: "text-lg" }` are the same shape at runtime, and guessing which one
 * was meant is exactly the silent mistake this package exists to prevent. Put the
 * dictionary in an array — `[{ "text-lg": on }]` — where nothing can be confused
 * with it.
 */
export type SsValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassValue[]
  | SsInput;

/**
 * Object accepted by {@link ss}: a `base` bucket for classes that take no further
 * prefix, plus one entry per Tailwind breakpoint (`sm`…`2xl`), `max-*` range, or
 * state variant (`hover`, `dark`, `group-hover`, …).
 *
 * Keys are a closed union, so every one is autocompleted and a typo is a compile
 * error rather than a class name that silently never matches anything.
 *
 * A bucket's value may be another map, which stacks the prefixes — that is how a
 * compound variant is written: `{ dark: { hover: "bg-black" } }` is
 * `dark:hover:bg-black`.
 */
export type SsInput = { base?: SsValue } & { [K in SsKey]?: SsValue };

/**
 * One argument of a variadic {@link ss} call.
 *
 * Identical to {@link SsValue} on purpose: an argument is just a bucket whose
 * prefix happens to be empty.
 */
export type SsArg = SsValue;

/** Breakpoint -> classes that apply at that breakpoint and up. */
export type ResponsiveMap = { [K in ScreenKey]?: ClassValue };

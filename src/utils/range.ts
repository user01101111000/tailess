import type { ScreenKey } from "../constants.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Apply classes only *below* a breakpoint, via Tailwind's `max-*` variant — the
 * complement of {@link responsive}, which is min-width.
 *
 * @example
 * until("md", "hidden"); // => "max-md:hidden"  (applies below md)
 */
export function until(key: ScreenKey, classes: ClassValue): string {
  return cn(withPrefix(`max-${key}`, classes));
}

/**
 * Apply classes only *between* two breakpoints — inclusive of `min`, exclusive of
 * `max` — by stacking a min-width variant with a `max-*` variant.
 *
 * @example
 * between("sm", "lg", "block"); // => "sm:max-lg:block"  (sm up to, not including, lg)
 */
export function between(min: ScreenKey, max: ScreenKey, classes: ClassValue): string {
  return cn(withPrefix(`${min}:max-${max}`, classes));
}

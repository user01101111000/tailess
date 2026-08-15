import { type ScreenKey, screenKeys } from "../constants.js";
import { isDev } from "../internal/env.js";

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
  if (isDev && screenKeys.indexOf(min) >= screenKeys.indexOf(max)) {
    // `lg:max-sm:` is a perfectly valid class that no viewport can ever satisfy, so
    // it produces CSS, passes every check, and styles nothing. Reversed arguments are
    // the obvious way to land here.
    console.warn(
      `[tailess] between("${min}", "${max}", …) describes an empty range: "${min}" is ` +
        `not narrower than "${max}", so the classes can never apply. Did you mean ` +
        `between("${max}", "${min}", …)?`,
    );
  }
  return cn(withPrefix(`${min}:max-${max}`, classes));
}

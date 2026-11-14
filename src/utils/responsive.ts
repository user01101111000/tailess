import { screenKeys } from "../constants.js";
import type { ClassValue, ResponsiveMap } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Build a mobile-first class string from a `base` value plus per-breakpoint
 * (min-width) overrides. Breakpoints are emitted smallest-first regardless of the
 * order you wrote them, and the result runs through {@link cn}.
 *
 * The overrides may be falsy, which drops them all — so a whole map can sit behind a
 * condition the way a single class does.
 *
 * @example
 * responsive("text-sm", { md: "text-lg", xl: "text-2xl" });
 * // => "text-sm md:text-lg xl:text-2xl"
 *
 * @example
 * responsive("text-sm", isWide && { md: "text-lg" });
 * // isWide === false => "text-sm"
 */
export function responsive(
  base: ClassValue,
  variants?: ResponsiveMap | false | null | undefined,
): string {
  const parts: ClassValue[] = [base];

  // A default parameter covers `undefined` and nothing else: `cond ? map : null` read a
  // key off `null` and took the render down, and `cond && map` only got through because
  // indexing `false` happens to be legal.
  if (variants) {
    for (const key of screenKeys) {
      const value = variants[key];
      if (value == null || value === false || value === "") continue;
      parts.push(withPrefix(key, value));
    }
  }

  return cn(...parts);
}

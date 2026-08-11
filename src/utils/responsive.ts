import { screenKeys } from "../constants.js";
import type { ClassValue, ResponsiveMap } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Build a mobile-first class string from a `base` value plus per-breakpoint
 * (min-width) overrides. Breakpoints are emitted smallest-first regardless of the
 * order you wrote them, and the result runs through {@link cn}.
 *
 * @example
 * responsive("text-sm", { md: "text-lg", xl: "text-2xl" });
 * // => "text-sm md:text-lg xl:text-2xl"
 */
export function responsive(base: ClassValue, variants: ResponsiveMap = {}): string {
  const parts: ClassValue[] = [base];

  for (const key of screenKeys) {
    const value = variants[key];
    if (value == null || value === false || value === "") continue;
    parts.push(withPrefix(key, value));
  }

  return cn(...parts);
}

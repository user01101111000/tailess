import type { ClassValue } from "clsx";
import type { ResolvedConfig } from "../config/types.js";
import { isDev } from "../internal/env.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

function warnUnknown(fn: string, key: string): void {
  if (isDev) {
    console.warn(`[tailess] ${fn}(): breakpoint "${key}" is not defined in config.screens.`);
  }
}

/**
 * Apply classes only *below* a breakpoint, using Tailwind's `max-*` variant.
 * The complement of {@link responsive}, which is min-width (mobile-first).
 *
 * Any breakpoint key present in your config — including custom ones — is valid.
 *
 * @example
 * until(config, "md", "hidden");
 * // => "max-md:hidden"  (applies below the md breakpoint)
 */
export function until(config: ResolvedConfig, key: string, classes: ClassValue): string {
  if (!(key in config.screens)) warnUnknown("until", key);
  return cn(withPrefix(`max-${key}`, classes));
}

/**
 * Apply classes only *between* two breakpoints (inclusive of `min`, exclusive of
 * `max`), by combining a min-width variant with a `max-*` variant.
 *
 * @example
 * between(config, "sm", "lg", "block");
 * // => "sm:max-lg:block"  (applies from sm up to, but not including, lg)
 */
export function between(
  config: ResolvedConfig,
  min: string,
  max: string,
  classes: ClassValue,
): string {
  if (!(min in config.screens)) warnUnknown("between", min);
  if (!(max in config.screens)) warnUnknown("between", max);
  return cn(withPrefix(`${min}:max-${max}`, classes));
}

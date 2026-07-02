import type { ClassValue } from "clsx";
import type { ResolvedConfig } from "../config/types.js";
import { isDev } from "../internal/env.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * A map of breakpoint key -> classes for that breakpoint and up.
 */
export type ResponsiveMap = Record<string, ClassValue>;

/**
 * Build a responsive class string from a base value plus per-breakpoint
 * overrides. Breakpoints are emitted in the order declared in `config.screens`
 * (mobile-first), and the result is passed through {@link cn} so conflicting
 * utilities within the same breakpoint are merged.
 *
 * Any breakpoint key present in your config — including custom ones — is valid.
 *
 * @example
 * responsive(config, "text-sm", { md: "text-lg", "3xl": "text-2xl" });
 * // => "text-sm md:text-lg 3xl:text-2xl"
 */
export function responsive(
  config: ResolvedConfig,
  base: ClassValue,
  variants: ResponsiveMap = {},
): string {
  const parts: ClassValue[] = [base];
  const emitted = new Set<string>();

  for (const key of Object.keys(config.screens)) {
    const value = variants[key];
    if (value != null && value !== false) {
      parts.push(withPrefix(key, value));
      emitted.add(key);
    }
  }

  // Keys not registered in config.screens: still emit, but flag in dev.
  for (const key of Object.keys(variants)) {
    if (emitted.has(key)) continue;
    const value = variants[key];
    if (value == null || value === false) continue;
    if (isDev) {
      console.warn(`[tailess] responsive(): breakpoint "${key}" is not defined in config.screens.`);
    }
    parts.push(withPrefix(key, value));
  }

  return cn(...parts);
}

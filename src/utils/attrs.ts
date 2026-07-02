import type { ClassValue } from "clsx";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Prefix classes with a `data-*` attribute variant. Pass a `value` for the
 * `data-[name=value]:` form (common with headless UI libraries like Radix), or
 * omit it for the attribute-presence form `data-[name]:`.
 *
 * @example
 * data("state", "open", "opacity-100");
 * // => "data-[state=open]:opacity-100"
 *
 * @example
 * data("disabled", null, "pointer-events-none");
 * // => "data-[disabled]:pointer-events-none"
 */
export function data(
  name: string,
  value: string | number | boolean | null | undefined,
  classes: ClassValue,
): string {
  const selector = value == null ? `data-[${name}]` : `data-[${name}=${value}]`;
  return cn(withPrefix(selector, classes));
}

/**
 * Prefix classes with an `aria-*` attribute variant, e.g. `aria-expanded:`,
 * `aria-selected:`, `aria-checked:`.
 *
 * @example
 * aria("expanded", "rotate-180");
 * // => "aria-expanded:rotate-180"
 */
export function aria(name: string, classes: ClassValue): string {
  return cn(withPrefix(`aria-${name}`, classes));
}

import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/** What an attribute variant compares against: a value, or nothing for mere presence. */
type AttributeValue = string | number | boolean | null | undefined;

/** `kind-[name=value]`, or `kind-[name]` when there is no value to compare against. */
function attribute(kind: "data" | "aria", name: string, value: AttributeValue): string {
  return value == null ? `${kind}-[${name}]` : `${kind}-[${name}=${value}]`;
}

/**
 * Prefix classes with a `data-*` attribute variant. Pass a `value` for the
 * `data-[name=value]:` form (what headless UI libraries like Radix use), or
 * `null`/`undefined` for the attribute-presence form `data-[name]:`.
 *
 * @example
 * data("state", "open", "opacity-100");              // => "data-[state=open]:opacity-100"
 * data("disabled", null, "pointer-events-none");     // => "data-[disabled]:pointer-events-none"
 */
export function data(name: string, value: AttributeValue, classes: ClassValue): string {
  return cn(withPrefix(attribute("data", name, value), classes));
}

/**
 * Prefix classes with an `aria-*` attribute variant.
 *
 * With two arguments it is the bare form — `aria-expanded:`, `aria-selected:`,
 * `aria-checked:` — which Tailwind reads as the attribute being `"true"`. That covers
 * every boolean ARIA state.
 *
 * The ones that are not boolean need the value said: `aria-current="page"`,
 * `aria-sort="ascending"`, `aria-orientation="vertical"`. Give it as a middle argument
 * and this builds `aria-[name=value]:`, exactly the way {@link data} does — including
 * `null`/`undefined` for the attribute merely being present.
 *
 * @example
 * aria("expanded", "rotate-180");               // => "aria-expanded:rotate-180"
 * aria("current", "page", "font-semibold");     // => "aria-[current=page]:font-semibold"
 * aria("sort", "ascending", "text-blue-700");   // => "aria-[sort=ascending]:text-blue-700"
 */
export function aria(name: string, classes: ClassValue): string;
export function aria(name: string, value: AttributeValue, classes: ClassValue): string;
export function aria(name: string, ...rest: [ClassValue] | [AttributeValue, ClassValue]): string {
  // Told apart by how many arguments there are, never by what they hold: a class value
  // and an attribute value are both strings, and `aria("expanded", undefined)` is still
  // the two-argument form with nothing to apply.
  if (rest.length < 2) return cn(withPrefix(`aria-${name}`, rest[0] as ClassValue));
  return cn(withPrefix(attribute("aria", name, rest[0] as AttributeValue), rest[1]));
}

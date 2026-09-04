import { warnUnusableValue } from "../internal/arbitrary.js";
import { escapeCondition } from "../internal/condition.js";
import { isDev } from "../internal/env.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/** Build the prefix, checking the selector in development. */
function prefixFor(helper: string, selector: string, variant: string): string {
  if (isDev) warnUnusableValue(helper, "selector", selector.trim());
  return `${variant}-[${escapeCondition(selector)}]`;
}

/**
 * Apply classes when the element **contains** something matching `selector`, via
 * Tailwind's `has-*` variant.
 *
 * Write the selector the way CSS spells it — spaces and all. A class name cannot hold
 * a space, so Tailwind wants `_` there, and this does that for you: `has("> img", …)`
 * is the difference between a working class and two class names that style nothing.
 *
 * For a plain state there is a key and no helper is needed — `ss({ "has-checked": … })`
 * covers the same 36 states `group-*` and `peer-*` do. This is for the selector form.
 *
 * @example
 * has(":checked", "bg-blue-50");   // => "has-[:checked]:bg-blue-50"
 * has("> img", "p-0");             // => "has-[>_img]:p-0"
 * has("input[type=text]", "ring-2");
 */
export function has(selector: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("has", selector, "has"), classes));
}

/**
 * Apply classes when the element does **not** contain anything matching `selector`.
 *
 * Note which negation this is. `notHas(":checked", …)` builds `not-has-[:checked]:`,
 * which compiles to `:not(:has(:is(:checked)))` — *no* checked descendant. Tailwind
 * also accepts `has-not-[:checked]`, which is `:has(:not(:is(:checked)))` — a
 * descendant that is *not* checked. Both compile and they mean different things; if
 * you want the second, write it as `has(":not(:checked)", …)`.
 *
 * @example
 * notHas(":checked", "opacity-50");  // => "not-has-[:checked]:opacity-50"
 */
export function notHas(selector: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("notHas", selector, "not-has"), classes));
}

/**
 * Apply classes when the element is **inside** something matching `selector`, via
 * Tailwind's `in-*` variant — the complement of {@link has}.
 *
 * Named `inside` because `in` is a reserved word. As with `has`, the plain state form
 * is already a key: `ss({ "in-focus": … })`.
 *
 * @example
 * inside(".dark", "text-white");            // => "in-[.dark]:text-white"
 * inside("[data-theme=dark]", "bg-black");  // => "in-[[data-theme=dark]]:bg-black"
 */
export function inside(selector: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("inside", selector, "in"), classes));
}

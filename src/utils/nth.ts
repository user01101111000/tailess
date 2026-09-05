import { warnUnusableValue } from "../internal/arbitrary.js";
import { escapeCondition } from "../internal/condition.js";
import { isDev } from "../internal/env.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/** What an `nth-*` variant selects: a position, or an `An+B` / keyword expression. */
export type NthValue = number | string;

/**
 * Positions already reported, so a warning in a render loop is printed once — keyed
 * on the helper as well, since the same mistake in `nth` and in `nthOfType` is two
 * call sites, and reporting only the first would leave the second silent.
 */
const warnedPositions = new Set<string>();

/**
 * Warn about a number that builds a class matching nothing.
 *
 * `:nth-child()` counts from 1, so `nth(0, …)` is a rule that can never apply — it
 * compiles, it passes every other check, and the element is simply never selected.
 * A fraction is worse: `nth-1.5` puts a `.` in the class name, which reads as a
 * second class.
 */
function warnUnusablePosition(helper: string, position: number): void {
  if (Number.isInteger(position) && position > 0) return;
  const seen = `${helper} ${position}`;
  if (warnedPositions.has(seen)) return;
  warnedPositions.add(seen);
  console.warn(
    `[tailess] ${helper}(${position}, …) — positions count from 1 and must be whole, so ` +
      "this builds a class that can never match. Pass an expression as a string for " +
      `anything else: ${helper}("2n+1", …).`,
  );
}

/**
 * Build `variant-<value>`, bare for a plain position and bracketed for anything else.
 *
 * Both spellings compile to the same rule — `nth-3` and `nth-[3]` are each
 * `:nth-child(3)` — so the bare one is used where it reads better, and the bracket
 * form carries everything else, escaped the way every other arbitrary value is.
 */
function prefixFor(helper: string, variant: string, value: NthValue): string {
  if (typeof value === "number") {
    if (isDev) warnUnusablePosition(helper, value);
    return `${variant}-${value}`;
  }
  if (isDev) warnUnusableValue(helper, "position", value.trim());
  return `${variant}-[${escapeCondition(value)}]`;
}

/**
 * Apply classes to the nth child, via Tailwind's `nth-*` variant.
 *
 * A number is a position, counting from 1. A string is an `An+B` expression or a
 * keyword, and goes in brackets — spaces and all, since they are escaped for you.
 *
 * `odd` and `even` are their own variants and already keys, so reach for those
 * directly: `ss({ odd: "bg-neutral-50" })`.
 *
 * @example
 * nth(3, "bg-neutral-50");     // => "nth-3:bg-neutral-50"
 * nth("3n + 1", "border-t");   // => "nth-[3n_+_1]:border-t"
 * nth("-n+3", "font-bold");    // => "nth-[-n+3]:font-bold"
 */
export function nth(value: NthValue, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("nth", "nth", value), classes));
}

/**
 * The same, counting from the end — `:nth-last-child()`.
 *
 * @example
 * nthLast(1, "border-b-0");    // => "nth-last-1:border-b-0"
 * nthLast("-n+2", "text-sm");  // => "nth-last-[-n+2]:text-sm"
 */
export function nthLast(value: NthValue, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("nthLast", "nth-last", value), classes));
}

/**
 * Counting only siblings of the same element type — `:nth-of-type()`.
 *
 * @example
 * nthOfType(2, "mt-4");        // => "nth-of-type-2:mt-4"
 * nthOfType("odd", "bg-white") // => "nth-of-type-[odd]:bg-white"
 */
export function nthOfType(value: NthValue, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("nthOfType", "nth-of-type", value), classes));
}

/**
 * Same-type siblings, counting from the end — `:nth-last-of-type()`.
 *
 * @example
 * nthLastOfType(1, "mb-0");    // => "nth-last-of-type-1:mb-0"
 */
export function nthLastOfType(value: NthValue, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("nthLastOfType", "nth-last-of-type", value), classes));
}

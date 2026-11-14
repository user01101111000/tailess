import { ownOr } from "../internal/lookup.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";

/**
 * The cases a discriminant of type `K` has to be given a class for.
 *
 * A string or a number is its own key. A boolean is looked up under `"true"` and
 * `"false"`, because that is what an object literal's `true:` and `false:` keys are.
 * `null` and `undefined` name no case at all — they are what an optional prop is when
 * nobody passed it — so they ask for nothing and take the fallback.
 */
type CaseOf<K> = K extends string | number ? K : K extends boolean ? `${K}` : never;

/**
 * Pick a class value from a lookup keyed by a discriminant (a variant prop, size,
 * tone…). `options` must cover every possible value of `key`, so a missing case is
 * a compile error; an unmatched `key` at runtime falls back to `fallback` (or `""`).
 * The result runs through {@link cn}.
 *
 * The discriminant is whatever the component already has: a string union, a number
 * (`cols: 1 | 2 | 3`), a boolean, or any of those made optional. A `key` that is
 * `null` or `undefined` matches no case and takes the fallback, so an optional prop can
 * be passed straight through.
 *
 * Extra keys beyond `key`'s type are allowed, which matters more than it sounds:
 * TypeScript narrows a `const size: "sm" | "lg" = "sm"` down to `"sm"` at the call
 * site, and a `Record<K, …>` parameter would then reject the `lg` entry as an excess
 * property. Inferring the object's own type keeps the superset legal while still
 * demanding every case be covered.
 *
 * Because every class here is a literal in your source, Tailwind's scanner finds
 * them on its own — `match` needs no build integration.
 *
 * @example
 * match(size, { sm: "text-sm", md: "text-base", lg: "text-lg" });
 * // size === "md" => "text-base"
 *
 * @example
 * match(tone, { primary: "bg-blue-600", danger: "bg-red-600" }, "bg-gray-200");
 *
 * @example
 * match(cols, { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" });
 * match(isOpen, { true: "rotate-180", false: "rotate-0" });
 */
export function match<
  K extends string | number | boolean | null | undefined,
  const O extends Record<CaseOf<K>, ClassValue>,
>(key: K, options: O, fallback?: ClassValue): string {
  // Stringified here rather than left to the property read, so `null` and `undefined`
  // cannot find a case that happens to be spelled `"null"` or `"undefined"`.
  const value =
    key == null ? fallback : ownOr(options as Record<string, ClassValue>, String(key), fallback);
  return cn(value ?? fallback);
}

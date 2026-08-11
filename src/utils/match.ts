import { ownOr } from "../internal/lookup.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";

/**
 * Pick a class value from a lookup keyed by a discriminant (a variant prop, size,
 * tone…). `options` must cover every possible value of `key`, so a missing case is
 * a compile error; an unmatched `key` at runtime falls back to `fallback` (or `""`).
 * The result runs through {@link cn}.
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
 */
export function match<K extends string, const O extends Record<K, ClassValue>>(
  key: K,
  options: O,
  fallback?: ClassValue,
): string {
  const value = ownOr(options as Record<string, ClassValue>, key, fallback);
  return cn(value ?? fallback);
}

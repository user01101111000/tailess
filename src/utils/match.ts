import type { ClassValue } from "clsx";
import { ownOr } from "../internal/lookup.js";
import { cn } from "./cn.js";

/**
 * Pick a class value from a lookup keyed by a discriminant (a variant prop,
 * size, tone...). `options` must cover every possible value of `key`, so the
 * mapping is checked at compile time. When `key` has no matching entry at
 * runtime, `fallback` is used (or an empty string).
 *
 * The result is passed through {@link cn}, so multi-class values are normalized
 * and Tailwind conflicts are merged.
 *
 * @example
 * match(size, { sm: "text-sm", md: "text-base", lg: "text-lg" });
 * // size === "md" => "text-base"
 *
 * @example
 * match(tone, { primary: "bg-blue-600", danger: "bg-red-600" }, "bg-gray-200");
 */
export function match<K extends string>(
  key: K,
  options: Record<K, ClassValue>,
  fallback?: ClassValue,
): string {
  const value = ownOr(options as Record<string, ClassValue>, key, fallback);
  return cn(value ?? fallback);
}

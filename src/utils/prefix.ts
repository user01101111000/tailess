import { type ClassValue, clsx } from "clsx";

/**
 * Apply a Tailwind variant prefix to every class token in `value`.
 *
 * @example
 * withPrefix("md", "text-lg font-bold"); // => "md:text-lg md:font-bold"
 */
export function withPrefix(prefix: string, value: ClassValue): string {
  return clsx(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `${prefix}:${token}`)
    .join(" ");
}

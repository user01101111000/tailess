import { twMerge } from "tailwind-merge";
import { join } from "../internal/join.js";
import type { ClassValue } from "../types.js";

/**
 * Conditionally join class names — `clsx` semantics, via {@link join} — and resolve
 * Tailwind conflicts with `tailwind-merge`, so the last utility in a conflicting
 * group wins.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
 * // => "py-1 bg-blue-500 px-4"  (px-2 dropped in favor of px-4)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(join(inputs));
}

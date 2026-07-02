import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditionally join class names (via `clsx`) and resolve Tailwind conflicts
 * (via `tailwind-merge`), so the last utility in a conflicting group wins.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
 * // => "py-1 bg-blue-500 px-4"  (px-2 dropped in favor of px-4)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

import type { StateKey } from "../constants.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Prefix classes with one or more Tailwind state variants. Passing an array
 * stacks them in order, which is how you express a compound variant like
 * `dark:hover:`.
 *
 * @example
 * on("hover", "bg-blue-600 text-white"); // => "hover:bg-blue-600 hover:text-white"
 * on(["dark", "hover"], "bg-black");     // => "dark:hover:bg-black"
 */
export function on(state: StateKey | readonly StateKey[], classes: ClassValue): string {
  const prefix = typeof state === "string" ? state : state.join(":");
  if (prefix === "") return "";
  return cn(withPrefix(prefix, classes));
}

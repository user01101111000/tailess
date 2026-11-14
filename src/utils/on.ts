import type { CustomKeys, StateKey } from "../constants.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * A variant {@link on} can apply: one of Tailwind's own states, or a key the project
 * declared for its own CSS.
 *
 * The declared ones are here because `ss` already takes them. A `@custom-variant
 * sidebar-open` that worked as `ss({ "sidebar-open": … })` and was a compile error as
 * `on("sidebar-open", …)` made the two spellings of one thing disagree about it.
 */
type OnKey = StateKey | (keyof CustomKeys & string);

/**
 * Prefix classes with one or more Tailwind state variants. Passing an array
 * stacks them in order, which is how you express a compound variant like
 * `dark:hover:`.
 *
 * @example
 * on("hover", "bg-blue-600 text-white"); // => "hover:bg-blue-600 hover:text-white"
 * on(["dark", "hover"], "bg-black");     // => "dark:hover:bg-black"
 */
export function on(state: OnKey | readonly OnKey[], classes: ClassValue): string {
  const prefix = typeof state === "string" ? state : state.join(":");
  if (prefix === "") return "";
  return cn(withPrefix(prefix, classes));
}

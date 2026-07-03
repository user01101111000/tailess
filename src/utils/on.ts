import type { ClassValue } from "clsx";
import type { ResolvedConfig } from "../config/types.js";
import { ownOr } from "../internal/lookup.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Prefix classes with one or more state variants registered in `config.states`
 * (e.g. `hover`, `focus`, `dark`, or any custom key). Unknown keys fall back to
 * being used verbatim as the prefix. Passing an array stacks the variants in
 * order, so you can express compound variants like `dark:hover:`.
 *
 * @example
 * on(config, "hover", "bg-blue-600 text-white");
 * // => "hover:bg-blue-600 hover:text-white"
 *
 * @example
 * on(config, ["dark", "hover"], "bg-black");
 * // => "dark:hover:bg-black"
 */
export function on(config: ResolvedConfig, state: string | string[], classes: ClassValue): string {
  const states = Array.isArray(state) ? state : [state];
  const prefix = states.map((s) => ownOr(config.states, s, s)).join(":");
  return cn(withPrefix(prefix, classes));
}

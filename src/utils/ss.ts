import type { ClassValue } from "clsx";
import type { ResolvedConfig } from "../config/types.js";
import { isDev } from "../internal/env.js";
import { ownOr } from "../internal/lookup.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Object form accepted by {@link ss}: a `base` bucket for unprefixed classes,
 * plus one entry per breakpoint or state key. Each value is prefixed with its
 * key and everything is merged in a stable, mobile-first order.
 */
export type SsInput = { base?: ClassValue } & Record<string, ClassValue>;

/**
 * Group Tailwind classes by breakpoint/state instead of interleaving prefixes,
 * for far more readable markup.
 *
 * Order: `base` first, then breakpoints in `config.screens` order, then states
 * in `config.states` order. State keys resolve through `config.states` so
 * aliases (e.g. `groupHover` -> `group-hover`) work. The result runs through
 * {@link cn}, so conflicting utilities within the same prefix are merged.
 *
 * @example
 * ss(config, {
 *   base: "text-xl flex",
 *   sm: "block",
 *   md: "text-2xl",
 * });
 * // => "text-xl flex sm:block md:text-2xl"
 */
export function ss(config: ResolvedConfig, input: SsInput): string {
  const parts: ClassValue[] = [];
  // Keys that belong to this config (screens ∪ states ∪ base). Tracks membership,
  // not whether a value was emitted, so a registered key with a falsy value is
  // never mistaken for an unknown one.
  const known = new Set<string>(["base"]);

  const push = (prefix: string, value: ClassValue | undefined) => {
    if (value == null || value === false) return;
    parts.push(withPrefix(prefix, value));
  };

  if (input.base != null && input.base !== false) {
    parts.push(input.base);
  }

  for (const key of Object.keys(config.screens)) {
    known.add(key);
    push(key, input[key]);
  }

  for (const key of Object.keys(config.states)) {
    if (known.has(key)) continue;
    known.add(key);
    push(ownOr(config.states, key, key), input[key]);
  }

  // Keys not registered in the config: still emit, but flag in dev — only when
  // they actually carry classes, so a falsy value never triggers a warning.
  for (const key of Object.keys(input)) {
    if (known.has(key)) continue;
    const value = input[key];
    if (value == null || value === false) continue;
    if (isDev) {
      console.warn(
        `[tailess] ss(): key "${key}" is not defined in config.screens or config.states.`,
      );
    }
    push(ownOr(config.states, key, key), value);
  }

  return cn(...parts);
}

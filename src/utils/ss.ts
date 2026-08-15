import { clsx } from "clsx";
import { rankOf, unknownRank } from "../constants.js";
import { isDev } from "../internal/env.js";

import type { ClassValue, SsInput } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Group Tailwind classes by breakpoint/state in a readable object instead of
 * interleaving prefixes inside one long string.
 *
 * `base` holds unprefixed classes; every other key is a Tailwind breakpoint
 * (`sm`…`2xl`), a `max-*` range, or a state variant (`hover`, `dark`,
 * `group-hover`, …) — all autocompleted, and a typo is a compile error.
 *
 * Output order is always `base`, breakpoints mobile-first, `max-*` largest-first,
 * then states — regardless of the order you wrote the keys in — and the result
 * runs through {@link cn}, so conflicting utilities are merged.
 *
 * Each value is a `clsx`-style `ClassValue`, so conditions go inline. A bucket
 * whose value is falsy is dropped entirely, prefix included.
 *
 * @example
 * ss({ base: "text-xl flex", sm: "block", md: "text-2xl", hover: "opacity-100" });
 * // => "text-xl flex sm:block md:text-2xl hover:opacity-100"
 *
 * @example
 * ss({ base: "grid", md: isWide && "grid-cols-3", "max-sm": "gap-2" });
 * // isWide === false => "grid max-sm:gap-2"
 */
export function ss(input: SsInput): string {
  const source = input as Record<string, ClassValue>;
  const names = Object.keys(source);

  // Parallel arrays rather than one object per key: `ss` sits in the render path
  // of every component that uses it, and the per-call garbage was most of its cost.
  const keys: string[] = [];
  const values: ClassValue[] = [];
  const ranks: number[] = [];

  for (let i = 0; i < names.length; i += 1) {
    const key = names[i] as string;
    const value = source[key];
    if (value == null || value === false || value === "") continue;

    let rank = rankOf(key);
    if (rank === undefined) {
      rank = unknownRank;
      if (isDev) {
        console.warn(
          `[tailess] ss(): "${key}" is not a Tailwind breakpoint or state variant. ` +
            `It is still emitted as a "${key}:" prefix, but nothing validates it — ` +
            `use withPrefix("${key}", ...) if that's intentional.`,
        );
      }
    }
    keys.push(key);
    values.push(value);
    ranks.push(rank);
  }

  // Insertion sort: an `ss` call has a handful of keys, and being stable is what
  // keeps unknown keys — which all share `unknownRank` — in the order written.
  for (let i = 1; i < ranks.length; i += 1) {
    const key = keys[i] as string;
    const value = values[i] as ClassValue;
    const rank = ranks[i] as number;
    let j = i - 1;
    while (j >= 0 && (ranks[j] as number) > rank) {
      keys[j + 1] = keys[j] as string;
      values[j + 1] = values[j] as ClassValue;
      ranks[j + 1] = ranks[j] as number;
      j -= 1;
    }
    keys[j + 1] = key;
    values[j + 1] = value;
    ranks[j + 1] = rank;
  }

  // Concatenate as we go instead of collecting parts for a variadic `cn`: every
  // piece is already a flat class string, so the extra array and `clsx` pass over
  // it would only re-join what we just built.
  let joined = "";
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i] as string;
    const value = values[i] as ClassValue;
    const part = key === "base" ? clsx(value) : withPrefix(key, value);
    if (part === "") continue;
    joined = joined === "" ? part : `${joined} ${part}`;
  }

  return cn(joined);
}

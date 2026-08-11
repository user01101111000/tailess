import { rankOf, unknownRank } from "../constants.js";
import { isDev } from "../internal/env.js";
import type { ClassValue, SsInput } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

interface Bucket {
  rank: number;
  seq: number;
  key: string;
  value: ClassValue;
}

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
  const buckets: Bucket[] = [];
  let seq = 0;

  for (const key of Object.keys(source)) {
    const value = source[key];
    const at = seq++;
    if (value == null || value === false || value === "") continue;

    const rank = rankOf(key);
    if (rank === undefined) {
      if (isDev) {
        console.warn(
          `[tailess] ss(): "${key}" is not a Tailwind breakpoint or state variant. ` +
            `It is still emitted as a "${key}:" prefix, but nothing validates it — ` +
            `use withPrefix("${key}", ...) if that's intentional.`,
        );
      }
      buckets.push({ rank: unknownRank, seq: at, key, value });
      continue;
    }
    buckets.push({ rank, seq: at, key, value });
  }

  // Stable: known keys by their canonical rank, unknown keys in author order.
  buckets.sort((a, b) => a.rank - b.rank || a.seq - b.seq);

  const parts: ClassValue[] = [];
  for (const bucket of buckets) {
    parts.push(bucket.key === "base" ? bucket.value : withPrefix(bucket.key, bucket.value));
  }

  return cn(...parts);
}

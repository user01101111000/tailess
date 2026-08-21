import { rankOf, unknownRank } from "../constants.js";
import { isDev } from "../internal/env.js";
import { join } from "../internal/join.js";

import type { ClassValue, SsArg, SsInput, SsValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * How deep buckets may nest before we stop descending.
 *
 * Real code nests two or three deep (`md: { hover: … }`). The bound is here for the
 * object that reaches itself — `const a = {}; a.md = a`, one typo away in a
 * config-driven style map — which would otherwise recurse until the stack gives
 * out, taking the render down with it.
 */
const maxDepth = 10;

/**
 * True for a value that is a nested bucket map rather than classes.
 *
 * The *shape* decides, never the key names: a plain object is always a map, and an
 * array is always the `clsx` list form, so everything inside it — including a
 * `clsx` dictionary — is classes. Sniffing keys to tell the two apart would make
 * the same source mean different things depending on what you named a class, which
 * is the one failure mode this package refuses to have.
 */
function isMap(value: SsValue): value is SsInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function warnUnknownKey(key: string): void {
  console.warn(
    `[tailess] ss(): "${key}" is not a Tailwind breakpoint or state variant. ` +
      `It is still emitted as a "${key}:" prefix, but nothing validates it — ` +
      `use withPrefix("${key}", ...) if that's intentional.`,
  );
}

function warnTooDeep(scope: string): void {
  console.warn(
    `[tailess] ss(): buckets under "${scope}:" nest more than ${maxDepth} deep and ` +
      "were dropped. That is almost always an object that contains itself.",
  );
}

/**
 * Emit one bucket map, with every class it produces carrying `prefix`.
 *
 * Keys are emitted in canonical order — `base`, breakpoints mobile-first, `max-*`
 * largest-first, then states — whatever order they were written in, so the same
 * input always produces the same string and `tailwind-merge`'s "last one wins"
 * stays predictable.
 */
function emitMap(map: SsInput, prefix: string, depth: number): string {
  const source = map as Record<string, SsValue>;
  const names = Object.keys(source);

  // Parallel arrays rather than one object per key: `ss` sits in the render path
  // of every component that uses it, and the per-call garbage was most of its cost.
  const keys: string[] = [];
  const values: SsValue[] = [];
  const ranks: number[] = [];

  for (let i = 0; i < names.length; i += 1) {
    const key = names[i] as string;
    const value = source[key];
    if (value == null || value === false || value === "") continue;

    let rank = rankOf(key);
    if (rank === undefined) {
      rank = unknownRank;
      if (isDev) warnUnknownKey(key);
    }
    keys.push(key);
    values.push(value);
    ranks.push(rank);
  }

  // Insertion sort: a bucket map has a handful of keys, and being stable is what
  // keeps unknown keys — which all share `unknownRank` — in the order written.
  for (let i = 1; i < ranks.length; i += 1) {
    const key = keys[i] as string;
    const value = values[i] as SsValue;
    const rank = ranks[i] as number;
    let j = i - 1;
    while (j >= 0 && (ranks[j] as number) > rank) {
      keys[j + 1] = keys[j] as string;
      values[j + 1] = values[j] as SsValue;
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
    const value = values[i] as SsValue;
    // `base` contributes no segment of its own: at the top level that means
    // unprefixed, and inside a map it means the parent's prefix on its own.
    const scope = key === "base" ? prefix : prefix === "" ? key : `${prefix}:${key}`;

    let part: string;
    if (isMap(value)) {
      if (depth >= maxDepth) {
        if (isDev) warnTooDeep(scope);
        continue;
      }
      part = emitMap(value, scope, depth + 1);
    } else if (scope === "") {
      part = join(value as ClassValue);
    } else {
      part = withPrefix(scope, value as ClassValue);
    }

    if (part === "") continue;
    joined = joined === "" ? part : `${joined} ${part}`;
  }

  return joined;
}

/**
 * Group Tailwind classes by breakpoint and state in a readable object instead of
 * interleaving prefixes inside one long string — and compose as many of those
 * objects, conditions and plain class strings as you like in one call.
 *
 * `base` holds classes with no further prefix; every other key is a Tailwind
 * breakpoint (`sm`…`2xl`), a `max-*` range, or a state variant (`hover`, `dark`,
 * `group-hover`, …) — all autocompleted, and a typo is a compile error.
 *
 * A bucket's value is a `clsx`-style class value, so conditions go inline and a
 * falsy value drops the whole bucket, prefix included. It may also be *another
 * map*, which stacks the prefixes — that is how you write a compound variant.
 *
 * Keys inside a map are emitted in canonical order (`base`, breakpoints
 * mobile-first, `max-*` largest-first, then states) no matter how you wrote them.
 * The arguments themselves are never reordered, so a trailing `className` wins,
 * exactly as it does in {@link cn} — of which this is a strict superset. The whole
 * result runs through `cn`, so conflicting utilities merge.
 *
 * @example
 * ss({ base: "text-xl flex", sm: "block", md: "text-2xl", hover: "opacity-100" });
 * // => "text-xl flex sm:block md:text-2xl hover:opacity-100"
 *
 * @example
 * ss({ base: "rounded p-4", md: "p-6" }, isDisabled && { base: "opacity-50" }, className);
 * // isDisabled === false => "rounded p-4 md:p-6 " + className
 *
 * @example
 * ss({ dark: { base: "text-white", hover: "text-blue-300" } });
 * // => "dark:text-white dark:hover:text-blue-300"
 */
export function ss(...args: SsArg[]): string {
  // The single-map call is what nearly every call site is, and it is on the render
  // path: keep it at one map walk and one merge, with no argument loop at all.
  if (args.length === 1) {
    const only = args[0] as SsArg;
    if (only == null || only === false || only === "") return "";
    if (typeof only === "string") return cn(only);
    return cn(isMap(only) ? emitMap(only, "", 0) : join(only as ClassValue));
  }

  let joined = "";
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as SsArg;
    if (arg == null || arg === false || arg === "") continue;
    const part = isMap(arg) ? emitMap(arg, "", 0) : join(arg as ClassValue);
    if (part === "") continue;
    joined = joined === "" ? part : `${joined} ${part}`;
  }

  return cn(joined);
}

import { rankOf, unknownRank } from "../constants.js";
import { isDev } from "../internal/env.js";
import { join } from "../internal/join.js";
import { customRank, firstTime, warn } from "../internal/settings.js";
import type { ClassValue, SsArg, SsInput, SsValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * How deep buckets may nest before we stop descending.
 *
 * Real code nests two or three deep (`md: { hover: … }`). An object that reaches itself —
 * `const a = {}; a.md = a`, one typo away in a config-driven style map — is cut where it
 * closes, by {@link path}; this bound is the backstop behind that.
 */
const maxDepth = 10;

/**
 * The maps on the way down to the one being emitted.
 *
 * Bounding depth alone did not stop a cycle, only slowed it: a map reaching itself from
 * two keys took 2¹⁰ walks, from four keys 4¹⁰ — seconds per call, in production too —
 * and warned once per path. One array, reused across calls, because `ss` is on the render
 * path and per-call garbage was most of its cost; `ss` clears it before each map, so a
 * throwing `onWarn` cannot leave a stale entry behind.
 */
const path: object[] = [];
const warnedCycles = new WeakSet<object>();

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

/**
 * Keys and scopes already reported.
 *
 * This is the highest-frequency warning site in the package — one bucket map per
 * component per render — and it was the one with no memo: a project that has declared a
 * `@custom-variant` but not yet reached `configure({ keys })` got an identical console
 * line per render, thousands of them in a React dev session, and under the documented
 * fatal `onWarn` a throw on every one of them rather than the first.
 */
const warnedKeys = new Set<string>();
const warnedScopes = new Set<string>();

function warnUnknownKey(key: string): void {
  warn(
    `[tailess] ss(): "${key}" is not one of ss()'s keys. It is emitted as written, but ` +
      "nothing checks that Tailwind has that variant — declare it with configure({ keys }) " +
      "if it is yours, or use withPrefix().",
  );
}

function warnTooDeep(scope: string): void {
  warn(
    `[tailess] ss(): buckets under "${scope}:" nest more than ${maxDepth} deep and were dropped.`,
  );
}

function warnCycle(scope: string): void {
  warn(`[tailess] ss(): the map under "${scope}:" contains itself, so it was dropped there.`);
}

/**
 * Emit one bucket map, with every class it produces carrying `prefix`.
 *
 * Keys are emitted in canonical order — `base`, breakpoints mobile-first, `max-*`
 * largest-first, `@` containers smallest-first, `@max-*` largest-first, states, the
 * keys `configure({ keys })` declares in the order given, then any undeclared key —
 * whatever order they were written in, so the same
 * input always produces the same string and `tailwind-merge`'s "last one wins"
 * stays predictable.
 */
function emitMap(map: SsInput, prefix: string): string {
  const source = map as Record<string, SsValue>;
  const names = Object.keys(source);
  path.push(map);

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
      // A key the project declared for its own `@theme` or `@custom-variant` is not
      // unknown — it just is not one Tailwind ships, which is a different thing. It sorts
      // by its position in `configure({ keys })`, which is what makes the documented
      // "emitted after the built-in keys, in the order given" true: sharing one rank left
      // the emitted order at the mercy of how the object literal happened to be written.
      // An undeclared key goes after all of them: sharing the first declared key's rank
      // tied the two, and the written order decided which one a merge kept.
      const declared = customRank(key);
      rank = declared === undefined ? Number.POSITIVE_INFINITY : unknownRank + declared;
      if (isDev && declared === undefined && firstTime(warnedKeys, key)) warnUnknownKey(key);
    }
    keys.push(key);
    values.push(value);
    ranks.push(rank);
  }

  // Insertion sort: a bucket map has a handful of keys, and being stable is what keeps
  // keys that share a rank — the undeclared unknown ones — in the order written.
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
      if (path.includes(value)) {
        if (isDev && !warnedCycles.has(value)) {
          warnedCycles.add(value);
          warnCycle(scope);
        }
        continue;
      }
      if (path.length > maxDepth) {
        if (isDev && firstTime(warnedScopes, scope)) warnTooDeep(scope);
        continue;
      }
      part = emitMap(value, scope);
    } else if (scope === "") {
      part = join(value as ClassValue);
    } else {
      part = withPrefix(scope, value as ClassValue);
    }

    if (part === "") continue;
    joined = joined === "" ? part : `${joined} ${part}`;
  }

  path.pop();
  return joined;
}

/** Emit a top-level map, on a {@link path} cleared of anything a throw left behind. */
function emitRoot(map: SsInput): string {
  // A completed walk leaves it empty; only a throw leaves anything to clear.
  if (path.length !== 0) path.length = 0;
  return emitMap(map, "");
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
 * exactly as it does in {@link cn} — of which this is a superset for strings and arrays;
 * a bare `clsx` dictionary is a bucket map here, so it goes in an array. The whole
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
    return cn(isMap(only) ? emitRoot(only) : join(only as ClassValue));
  }

  let joined = "";
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as SsArg;
    if (arg == null || arg === false || arg === "") continue;
    const part = isMap(arg) ? emitRoot(arg) : join(arg as ClassValue);
    if (part === "") continue;
    joined = joined === "" ? part : `${joined} ${part}`;
  }

  return cn(joined);
}

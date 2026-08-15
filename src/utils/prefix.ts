import { type ClassValue, clsx } from "clsx";
import { isDev } from "../internal/env.js";

import { verifyIntegration } from "../internal/verify.js";

const unicodeSpace = /\s/;

/**
 * True for the characters that separate class tokens — exactly what `\s` matches,
 * so splitting here stays equivalent to the `/\s+/` this replaced.
 *
 * ASCII is settled inline because that is every realistic separator; the regex is
 * only consulted for the non-ASCII spaces (NBSP, ` `, the Unicode space
 * block), which can only turn up in an arbitrary value like `content-['→']`.
 */
function isBlank(code: number): boolean {
  if (code === 32) return true;
  if (code >= 9 && code <= 13) return true;
  return code > 127 && unicodeSpace.test(String.fromCharCode(code));
}

/** Prefixes already reported, so a warning in a render loop is printed once. */
const warnedPrefixes = new Set<string>();

/**
 * Warn, in dev, about a prefix that can never produce a working class.
 *
 * Whitespace is the case that matters: `data("state", "a b", …)` builds
 * `data-[state=a b]:p-2`, which the browser reads as *two* class names, neither
 * of which means anything — and the build scanner drops it for the same reason,
 * so no CSS is generated either. Everything agrees, silently, on nothing. Tailwind
 * spells a space in an arbitrary value with `_`, so that is what to say.
 */
function warnUnusablePrefix(prefix: string): void {
  for (let i = 0; i < prefix.length; i += 1) {
    if (!isBlank(prefix.charCodeAt(i))) continue;
    if (warnedPrefixes.has(prefix)) return;
    warnedPrefixes.add(prefix);
    console.warn(
      `[tailess] the variant prefix "${prefix}" contains whitespace, so it does not ` +
        "form a single class name and will never match anything. Tailwind writes a " +
        `space inside an arbitrary value as "_" — e.g. "${prefix.replace(unicodeSpaceGlobal, "_")}".`,
    );
    return;
  }
}

const unicodeSpaceGlobal = /\s/g;

/**
 * Apply a Tailwind variant prefix to every class token in `value`.
 *
 * This is the low-level primitive every other prefixing helper is built on. Use
 * it directly for variants tailess doesn't model as keys — arbitrary selectors,
 * `supports-*`, `has-*`, compound `group-[...]`, and so on.
 *
 * @example
 * withPrefix("md", "text-lg font-bold");   // => "md:text-lg md:font-bold"
 * withPrefix("supports-[display:grid]", "grid"); // => "supports-[display:grid]:grid"
 */
export function withPrefix(prefix: string, value: ClassValue): string {
  // `clsx` returns a string unchanged, so skip the call for the common case of
  // one already-flat class string.
  const flat = typeof value === "string" ? value : clsx(value);
  if (flat === "") return "";

  if (prefix === "") {
    if (isDev) {
      console.warn(
        "[tailess] withPrefix() was called with an empty prefix. The classes are " +
          'returned unprefixed, since an empty prefix would produce ":class", ' +
          "which matches nothing.",
      );
    }
    return flat;
  }

  if (isDev) warnUnusablePrefix(prefix);

  // Walk the token boundaries rather than splitting: this runs on every prefixed
  // class in a render, and an intermediate array per call is the bulk of its cost.
  let out = "";
  let start = -1;
  for (let i = 0; i <= flat.length; i += 1) {
    // The trailing iteration closes a token that runs to the end of the string.
    if (i === flat.length || isBlank(flat.charCodeAt(i))) {
      if (start !== -1) {
        const token = `${prefix}:${flat.slice(start, i)}`;
        out = out === "" ? token : `${out} ${token}`;
        start = -1;
      }
    } else if (start === -1) {
      start = i;
    }
  }

  if (out === "") return "";

  // A prefixed class only has CSS if the build integration told Tailwind about it.
  verifyIntegration();

  return out;
}

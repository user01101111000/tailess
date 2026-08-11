/// <reference types="node" />
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * A stylesheet is worth injecting into only if Tailwind can emit utilities there —
 * which means it pulls Tailwind in, directly or through a chain of `@import`s.
 *
 * Getting this wrong is costly in both directions, and both were measured against
 * the real compiler:
 *
 * - Too narrow and a split setup silently gets nothing. `app.css` containing just
 *   `@import "./tailwind.css";` is a normal way to organise styles, and the
 *   candidate list has to reach it.
 * - Too wide and `@source` leaks verbatim into the output of stylesheets Tailwind
 *   never compiles (a plain `.css` with no Tailwind at-rules bails immediately).
 *
 * Injecting into a file Tailwind *does* compile but which emits no utilities (a
 * partial, a `@reference`d CSS module) is harmless — it emits nothing and the
 * directive is consumed — but we avoid it anyway, since it would mean re-scanning
 * the project for every CSS module in the build.
 */

/** How many `@import` hops to follow before giving up. */
const maxDepth = 3;

const tailwindSpecifier = /(?:^|[/\\])tailwindcss(?:$|[/\\])|^tailwindcss/;
const utilitiesAtRule = /@tailwind\s+(?:utilities|all)\b/;
const importAtRule = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;

/** True if an `@import` specifier refers to Tailwind itself. */
export function isTailwindSpecifier(specifier: string): boolean {
  return tailwindSpecifier.test(specifier.trim());
}

/** True if this stylesheet has a `@tailwind utilities` (or `all`) at-rule. */
export function hasUtilitiesAtRule(css: string): boolean {
  return utilitiesAtRule.test(css);
}

/** Every `@import` specifier in `css`, in source order. */
export function importSpecifiers(css: string): string[] {
  const out: string[] = [];
  for (const match of css.matchAll(importAtRule)) {
    const specifier = match[1];
    if (specifier) out.push(specifier);
  }
  return out;
}

/** Read a stylesheet, tolerating a missing extension the way bundlers do. */
async function readStylesheet(path: string): Promise<string | undefined> {
  const candidates = /\.[a-z]+$/i.test(path) ? [path] : [path, `${path}.css`];
  for (const candidate of candidates) {
    const content = await readFile(candidate, "utf8").catch(() => undefined);
    if (content !== undefined) return content;
  }
  return undefined;
}

/**
 * Decide whether Tailwind will emit utilities into this stylesheet, following
 * relative `@import`s from `file` when the answer isn't visible locally.
 *
 * Bare specifiers other than Tailwind's own (`@import "@acme/styles"`) can't be
 * resolved without a bundler resolver, so they're treated as "not Tailwind". A
 * project that hides its Tailwind import behind one still gets the dev-time warning
 * rather than silence.
 */
export async function isTailwindEntry(
  css: string,
  file?: string,
  depth = maxDepth,
  seen: Set<string> = new Set(),
): Promise<boolean> {
  const specifiers = importSpecifiers(css);
  if (specifiers.some(isTailwindSpecifier)) return true;
  if (hasUtilitiesAtRule(css)) return true;
  if (depth <= 0 || !file) return false;

  const base = dirname(resolve(file));
  for (const specifier of specifiers) {
    // Only relative hops: anything else needs a resolver we don't have.
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
    const path = resolve(base, specifier);
    if (isAbsolute(path) === false || seen.has(path)) continue;
    seen.add(path);
    const nested = await readStylesheet(path);
    if (nested === undefined) continue;
    if (await isTailwindEntry(nested, path, depth - 1, seen)) return true;
  }

  return false;
}

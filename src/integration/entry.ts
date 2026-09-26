/// <reference types="node" />
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
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

/**
 * How many `@import` hops to follow before giving up. The `seen` set already stops a
 * cycle, so this only bounds the work; three hops was too few for a real layout
 * (`app.css` → `base.css` → `theme.css` → `tokens.css` → Tailwind), and the fourth hop
 * got no injection and no warning.
 */
export const maxDepth = 8;

/**
 * Resolves a bare or aliased `@import` specifier to a file, the way the bundler will —
 * `@/styles/tailwind.css` through a Vite alias, `@workspace/ui/globals.css` through a
 * workspace package. `undefined` when it cannot.
 */
export type ImportResolver = (specifier: string, importer: string) => Promise<string | undefined>;

/**
 * Node's own resolution, for the integrations that have no bundler resolver to ask:
 * it follows a workspace package's `exports`, which is how the shadcn/ui monorepo
 * template wires `@import "@workspace/ui/globals.css"`. Aliases stay out of reach.
 */
export const resolveWithNode: ImportResolver = async (specifier, importer) => {
  try {
    return createRequire(importer).resolve(specifier);
  } catch {
    return undefined;
  }
};

/** `https://…`, `data:…`, `//cdn…`: nothing on disk to follow. */
const remote = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const tailwindSpecifier = /(?:^|[/\\])tailwindcss(?:$|[/\\])|^tailwindcss/;
// An at-rule's *name* is ASCII case-insensitive in CSS, so `@Import` is the same
// rule as `@import`. The specifier is not — it resolves as a path — so only these
// two carry the flag, never `tailwindSpecifier`.
const utilitiesAtRule = /@tailwind\s+(?:utilities|all)\b/i;
const importAtRule = /@import\s+(?:url\(\s*)?["']([^"']+)["']/gi;

/** True if an `@import` specifier refers to Tailwind itself. */
export function isTailwindSpecifier(specifier: string): boolean {
  return tailwindSpecifier.test(specifier.trim());
}

/** True if this stylesheet has a `@tailwind utilities` (or `all`) at-rule. */
export function hasUtilitiesAtRule(css: string): boolean {
  return utilitiesAtRule.test(css);
}

/**
 * A Tailwind `@import` together with whatever options follow it, up to the `;` or the
 * start of a block. `@import "tailwindcss" source(none) prefix(tw);` is one match.
 */
const importWithOptions = /@import\s+(?:url\(\s*)?["']([^"']+)["'][^;{}]*/gi;
/** Tailwind v4's `prefix(…)` import option, which renames every class it generates. */
const prefixOption = /\bprefix\(\s*([\w-]+)\s*\)/i;
const cssComment = /\/\*[\s\S]*?\*\//g;

/**
 * The prefix Tailwind was imported with, if any.
 *
 * `@import "tailwindcss" prefix(tw)` makes the working class `tw:hover:underline`, so
 * every class tailess builds — which carries no prefix — generates no rule at all. The
 * failure is completely silent otherwise: the plugin runs, the marker is written, the
 * integration check passes, and nothing on the page has styles.
 */
export function tailwindPrefixIn(css: string): string | undefined {
  for (const match of css.replace(cssComment, "").matchAll(importWithOptions)) {
    const specifier = match[1];
    if (!specifier || !isTailwindSpecifier(specifier)) continue;
    const found = prefixOption.exec(match[0]);
    if (found?.[1]) return found[1];
  }
  return undefined;
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
export async function readStylesheet(path: string): Promise<string | undefined> {
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
 * A bare or aliased specifier (`@import "@acme/styles"`) is followed only through
 * `resolveImport`, when the caller has one. Without it such an import was never
 * followed, and an app stylesheet reaching Tailwind through a Vite alias or a workspace
 * package got no injection — every runtime-built class unstyled, with a dev warning
 * telling the reader to add a plugin that was already there.
 */
export async function isTailwindEntry(
  css: string,
  file?: string,
  depth = maxDepth,
  seen: Set<string> = new Set(),
  resolveImport?: ImportResolver,
): Promise<boolean> {
  const specifiers = importSpecifiers(css);
  if (specifiers.some(isTailwindSpecifier)) return true;
  if (hasUtilitiesAtRule(css)) return true;
  if (depth <= 0 || !file) return false;

  const importer = resolve(file);
  const base = dirname(importer);
  for (const specifier of specifiers) {
    if (remote.test(specifier)) continue;
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    const path = relative
      ? resolve(base, specifier)
      : await resolveImport?.(specifier, importer).catch(() => undefined);
    if (path === undefined || !isAbsolute(path) || seen.has(path)) continue;
    seen.add(path);
    const nested = await readStylesheet(path);
    if (nested === undefined) continue;
    if (await isTailwindEntry(nested, path, depth - 1, seen, resolveImport)) return true;
  }

  return false;
}

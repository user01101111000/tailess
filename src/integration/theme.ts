/// <reference types="node" />
import { dirname, isAbsolute, resolve } from "node:path";
import {
  containerKeys,
  maxContainerKeys,
  maxScreenKeys,
  screenKeys,
  screens,
  stateKeys,
} from "../constants.js";
import type { Diagnostic } from "../extract/diagnose.js";
import { importSpecifiers, readStylesheet } from "./entry.js";

/**
 * Breakpoints tailess ships keys for, checked against the ones the project's CSS
 * actually defines.
 *
 * `screenKeys` and `screens` are compiled in — they have to be, since the keys are a
 * closed union the compiler checks and `screens` is read from JS for `matchMedia`.
 * A `@theme` block can move all of that underneath them, and three of the four ways
 * it can are completely silent:
 *
 * - `--breakpoint-sm: initial` removes a breakpoint. `ss({ sm: … })` still compiles,
 *   still emits `sm:`, and no rule is ever generated for it.
 * - `--breakpoint-*: initial` removes every one of them at once, as do the wider
 *   `--*: initial` and the prefix form `--breakpoint-s-*: initial`.
 * - `--breakpoint-md: 50rem` keeps the key working but makes `screens.md` a lie, so
 *   JS and CSS disagree about where the breakpoint is.
 *
 * The fourth — adding `--breakpoint-3xl` — is at least loud, because `ss({ "3xl": … })`
 * is a compile error. It is reported anyway, since the error says nothing about the
 * escape hatch that does work.
 *
 * **`@config` silences all of it.** A v3-style JS config can set `theme.screens` too,
 * and that is a JavaScript file this never opens — evaluating a consumer's config is a
 * far larger surface than the question warrants. Rather than answer from half the
 * inputs and risk being confidently wrong, a project with a `@config` anywhere in its
 * stylesheet chain gets no answer at all.
 */

/** How many `@import` hops to follow. Matches {@link isTailwindEntry}'s budget. */
const maxDepth = 3;

/**
 * `@theme`, with or without a modifier (`inline`, `static`, `reference`).
 *
 * The lookahead is what keeps `@theme-ui` and `"@theme/tokens.css"` from matching:
 * `\b` alone treats `-` and `/` as boundaries, and `[^{]*` would then run to the next
 * `{` anywhere in the file and read an ordinary rule's body as a theme. That turned an
 * aliased `@import` into a warning about CSS that was doing nothing wrong. Excluding
 * `;`, `"` and `'` from the gap keeps the scan inside one at-rule prelude.
 */
const themeAtRule = /@theme(?=[\s{])[^{;"']*\{/gi;

/** A `--breakpoint-*` custom property inside one. */
const breakpointDecl = /--breakpoint-([\w-]*\*|[\w-]+)\s*:\s*([^;}]*)/g;

/** Tailwind's whole-theme reset, which takes the breakpoints with it. */
const themeReset = /--\*\s*:\s*([^;}]*)/g;

/**
 * CSS comments, removed before anything else is read.
 *
 * A commented-out declaration is not one, and reporting it would be a warning fired
 * at code that is already doing the right thing — the failure mode this whole check
 * is written to avoid. Stripping first also settles brace counting, since a comment
 * is free to hold an unmatched `{`.
 */
const comment = /\/\*[\s\S]*?\*\//g;

/**
 * String literals, removed alongside the comments.
 *
 * No breakpoint value is ever quoted, so nothing real is lost — while a quoted one
 * holding the text of a whole `@theme` block (a `content:` value, a `url()`) would
 * otherwise be read as CSS and reported.
 */
const stringLiteral = /"[^"\n]*"|'[^'\n]*'/g;

/**
 * A `@config` at-rule, which points at a v3-style JavaScript config.
 *
 * That file can set `theme.screens`, and it is not something this opens — so when one
 * is present the CSS in hand is only part of the answer, and the honest response is
 * none at all rather than a confident one drawn from half the inputs.
 */
const configAtRule = /@config(?=[\s"'])/i;

/**
 * `@custom-variant <name>`, in either the `(…)` or the `{ … @slot; }` form.
 *
 * Only the name is needed: whatever the body says, Tailwind registers it as a static
 * variant, and a static variant tailess has no key for is a compile error on a class
 * that works perfectly.
 */
const customVariantAtRule = /@custom-variant\s+([\w-]+)/g;

/** Every key `ss` accepts, for deciding whether a custom variant is already one. */
const everyKey = new Set<string>([
  ...stateKeys,
  ...screenKeys,
  ...maxScreenKeys,
  ...containerKeys,
  ...maxContainerKeys,
]);

/**
 * Every `@custom-variant` name `css` defines that tailess has no key for.
 *
 * A redefinition of a name that *is* a key is deliberately not reported: Tailwind
 * simply replaces the variant, the key still resolves, and the class still works —
 * whether the new meaning is what the author wanted is not something this can judge,
 * and guessing would fire a warning at working CSS.
 */
export function customVariantsIn(source: string): string[] {
  if (hasJsConfig(source)) return [];
  const css = source.replace(comment, "").replace(stringLiteral, "");
  const found: string[] = [];

  customVariantAtRule.lastIndex = 0;
  for (let m = customVariantAtRule.exec(css); m !== null; m = customVariantAtRule.exec(css)) {
    const name = m[1] as string;
    if (!everyKey.has(name) && !found.includes(name)) found.push(name);
  }

  return found;
}

/** True if the project defers part of its theme to a JS config. */
export function hasJsConfig(css: string): boolean {
  return configAtRule.test(css.replace(comment, ""));
}

/**
 * One `--breakpoint-*` declaration, in source order.
 *
 * Order is the whole point of keeping these as a list rather than a map: `initial`
 * removes what came before it and nothing after, so `--breakpoint-md: 50rem` followed
 * by `--breakpoint-*: initial` leaves `md` gone, while the same two lines the other
 * way round leave it working at 50rem. A map would read both as the same input.
 */
export interface BreakpointDecl {
  /** The key, `*` for a whole-namespace reset, or `<prefix>*` for a partial one. */
  name: string;
  value: string;
}

/**
 * Every `--breakpoint-*` declared in a `@theme` block of `css`, in source order.
 *
 * Text rather than an AST because both integrations have to agree, and only one of
 * them has an AST at the point this runs. Declarations outside `@theme` are ignored:
 * a `--breakpoint-x` in a plain rule is an ordinary custom property and defines no
 * variant — confirmed against the compiler, which leaves the breakpoint untouched.
 */
export function breakpointsIn(source: string): BreakpointDecl[] {
  const found: BreakpointDecl[] = [];
  if (hasJsConfig(source)) return [];
  const css = source.replace(comment, "").replace(stringLiteral, "");

  themeAtRule.lastIndex = 0;
  for (let match = themeAtRule.exec(css); match !== null; match = themeAtRule.exec(css)) {
    // Walk to the matching `}` so a declaration after the block is not read as part
    // of it. Values can hold braces only inside a string, which no breakpoint has.
    let depth = 1;
    let end = themeAtRule.lastIndex;
    while (end < css.length && depth > 0) {
      const ch = css.charCodeAt(end);
      if (ch === 123) depth += 1;
      else if (ch === 125) depth -= 1;
      end += 1;
    }

    const body = css.slice(themeAtRule.lastIndex, depth === 0 ? end - 1 : css.length);

    // Both patterns, interleaved by position, because `--*: initial` and a
    // `--breakpoint-*` line only mean what they do relative to each other.
    const hits: Array<{ at: number; decl: BreakpointDecl }> = [];
    breakpointDecl.lastIndex = 0;
    for (let m = breakpointDecl.exec(body); m !== null; m = breakpointDecl.exec(body)) {
      hits.push({ at: m.index, decl: { name: m[1] as string, value: (m[2] ?? "").trim() } });
    }
    themeReset.lastIndex = 0;
    for (let m = themeReset.exec(body); m !== null; m = themeReset.exec(body)) {
      hits.push({ at: m.index, decl: { name: "*", value: (m[1] ?? "").trim() } });
    }
    hits.sort((a, b) => a.at - b.at);
    for (const hit of hits) found.push(hit.decl);

    themeAtRule.lastIndex = end;
  }

  return found;
}

/**
 * Every breakpoint declared by `css` and by the stylesheets it relatively imports,
 * in the order the browser would see them.
 *
 * Same traversal and the same budget as {@link isTailwindEntry}, because it is the
 * same shape of question — a project that splits its theme into `theme.css` and
 * imports it is ordinary, and the answer has to follow it there.
 *
 * Imports come first and in source order, then the file's own declarations, which is
 * where CSS puts them: `@import` has to precede every other rule, so the importing
 * file's text is always the later one. Getting this backwards made a later import
 * that restores a default look like drift.
 */
export interface CollectedTheme {
  /** `--breakpoint-*` declarations, in the order the browser would apply them. */
  breakpoints: BreakpointDecl[];
  /** `@custom-variant` names tailess has no key for. */
  variants: string[];
}

export async function collectTheme(
  css: string,
  file?: string,
  depth = maxDepth,
  seen: Set<string> = new Set(),
): Promise<CollectedTheme> {
  const empty: CollectedTheme = { breakpoints: [], variants: [] };
  if (hasJsConfig(css)) return empty;

  const own: CollectedTheme = { breakpoints: breakpointsIn(css), variants: customVariantsIn(css) };
  if (depth <= 0 || !file) return own;

  // Comments stripped here too, so a commented-out `@import` is not followed into a
  // file whose theme has nothing to do with this build.
  const imported: CollectedTheme = { breakpoints: [], variants: [] };
  const base = dirname(resolve(file));
  for (const specifier of importSpecifiers(css.replace(comment, ""))) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
    const path = resolve(base, specifier);
    if (!isAbsolute(path) || seen.has(path)) continue;
    seen.add(path);
    const nested = await readStylesheet(path);
    if (nested === undefined) continue;
    // One `@config` anywhere in the chain silences the whole answer, not just its own
    // file: what it sets would apply to every one of them.
    if (hasJsConfig(nested)) return empty;
    const from = await collectTheme(nested, path, depth - 1, seen);
    imported.breakpoints.push(...from.breakpoints);
    imported.variants.push(...from.variants);
  }

  return {
    breakpoints: [...imported.breakpoints, ...own.breakpoints],
    variants: [...new Set([...imported.variants, ...own.variants])],
  };
}

/** Just the breakpoints, for callers that want nothing else. */
export async function collectBreakpoints(css: string, file?: string): Promise<BreakpointDecl[]> {
  return (await collectTheme(css, file)).breakpoints;
}

/** True for the value Tailwind reads as "remove this". */
const isRemoval = (value: string): boolean => value.toLowerCase() === "initial";

/**
 * Replay the declarations over Tailwind's defaults and return what is left.
 *
 * This is the whole model: a `@theme` is a sequence of edits, not a set of values.
 * `initial` on a name removes it, on `*` removes everything, and on `<prefix>*`
 * removes every name that starts with the prefix — which includes the exact name, so
 * `--breakpoint-sm-*: initial` takes `sm` with it. Anything else sets a value.
 */
function resolveBreakpoints(declared: readonly BreakpointDecl[]): Map<string, string> {
  const resolved = new Map<string, string>(screenKeys.map((key) => [key, screens[key]]));

  for (const { name, value } of declared) {
    const wildcard = name === "*" || name.endsWith("*");
    if (isRemoval(value)) {
      if (name === "*") {
        resolved.clear();
      } else if (wildcard) {
        const prefix = name.slice(0, -1).replace(/-$/, "");
        for (const key of [...resolved.keys()]) {
          if (key.startsWith(prefix)) resolved.delete(key);
        }
      } else {
        resolved.delete(name);
      }
      continue;
    }
    // A wildcard is only ever a reset; it never names a breakpoint of its own.
    if (!wildcard) resolved.set(name, value);
  }

  return resolved;
}

/** A breakpoint written as a plain length, which is the only form worth comparing. */
const length = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|em)$/i;

/**
 * True when two breakpoint values describe the same width.
 *
 * v4 spells the defaults in `rem` where v3 spelled them in `px`, so a project that
 * pins the v3 numbers — the standard migration, and a very common `@theme` — declares
 * `--breakpoint-md: 768px` for the width tailess already exports as `48rem`. Nothing
 * has drifted there, and saying so would fire five warnings on a build that is fine.
 *
 * Inside a media query `rem` and `em` both resolve against the *initial* font size
 * rather than the root element's, so 16 is exact rather than an assumption.
 */
function sameWidth(a: string, b: string): boolean {
  if (a === b) return true;
  const left = length.exec(a);
  const right = length.exec(b);
  if (!left || !right) return false;
  const px = (m: RegExpExecArray) => Number(m[1]) * (m[2]?.toLowerCase() === "px" ? 1 : 16);
  return px(left) === px(right);
}

/**
 * Compare what the theme leaves in place against what tailess ships, and report only
 * the differences that change what a call site can do.
 *
 * Nothing is reported for a theme that merely restates a default — in any unit — or
 * that customises anything other than the breakpoints.
 */
export function themeDiagnostics(
  declared: readonly BreakpointDecl[],
  variants: readonly string[] = [],
): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const name of variants) {
    out.push({
      kind: "theme-drift",
      message:
        `your CSS defines the "${name}" variant, which tailess has no key for, so ` +
        `ss({ "${name}": … }) will not compile. The class itself works — reach it with ` +
        `withPrefix("${name}", …).`,
    });
  }

  if (declared.length === 0) return out;

  const resolved = resolveBreakpoints(declared);
  const known = new Set<string>(screenKeys);

  for (const key of screenKeys) {
    const value = resolved.get(key);
    if (value === undefined) {
      out.push({
        kind: "theme-drift",
        message:
          `your theme removes the "${key}" breakpoint, but tailess still offers it as a ` +
          `key — ss({ "${key}": … }) compiles, emits "${key}:", and no rule is generated ` +
          "for it.",
      });
    } else if (!sameWidth(value, screens[key])) {
      out.push({
        kind: "theme-drift",
        message:
          `your theme sets "${key}" to ${value}, but tailess exports screens.${key} as ` +
          `${screens[key]} — the classes are fine, but matching this breakpoint from JS ` +
          "will use the wrong width.",
      });
    }
  }

  for (const name of resolved.keys()) {
    if (known.has(name)) continue;
    out.push({
      kind: "theme-drift",
      message:
        `your theme adds the "${name}" breakpoint, which tailess has no key for, so ` +
        `ss({ "${name}": … }) will not compile. The class itself works — reach it with ` +
        `withPrefix("${name}", …).`,
    });
  }

  return out;
}

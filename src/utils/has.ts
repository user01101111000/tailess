import { escapeCondition } from "../internal/condition.js";
import { isDev } from "../internal/env.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/** Selectors already inspected, so a warning in a render loop is printed once. */
const checkedSelectors = new Set<string>();

/** Characters a class name cannot carry, so the build never enumerates them. */
const unusableChar = /["{}\\;]/;

/**
 * Warn, in dev, about a selector that cannot become a working class.
 *
 * Both cases are silent otherwise: the class is built and lands on the element, and
 * either nothing generates a rule for it or the build cannot enumerate it at all.
 */
function warnUnusableSelector(helper: string, selector: string): void {
  const seen = `${helper} ${selector}`;
  if (checkedSelectors.has(seen)) return;
  checkedSelectors.add(seen);

  if (selector === "") {
    console.warn(
      `[tailess] ${helper}() was given an empty selector, which builds "…-[]:" — a ` +
        "class nothing ever generates a rule for.",
    );
    return;
  }
  // The candidate list is written into a stylesheet, so a selector carrying one of
  // these cannot be enumerated: the class reaches the element with no rule behind it.
  if (unusableChar.test(selector) || (selector.match(/'/g) ?? []).length % 2 === 1) {
    console.warn(
      `[tailess] the selector "${selector}" contains one of \`" { } \\ ;\` or an ` +
        "unclosed `'`, which cannot appear in a class name, so the build generates no " +
        "rule for it.",
    );
  }
}

/** Build the prefix, checking the selector in development. */
function prefixFor(helper: string, selector: string, variant: string): string {
  if (isDev) warnUnusableSelector(helper, selector.trim());
  return `${variant}-[${escapeCondition(selector)}]`;
}

/**
 * Apply classes when the element **contains** something matching `selector`, via
 * Tailwind's `has-*` variant.
 *
 * Write the selector the way CSS spells it — spaces and all. A class name cannot hold
 * a space, so Tailwind wants `_` there, and this does that for you: `has("> img", …)`
 * is the difference between a working class and two class names that style nothing.
 *
 * For a plain state there is a key and no helper is needed — `ss({ "has-checked": … })`
 * covers the same 36 states `group-*` and `peer-*` do. This is for the selector form.
 *
 * @example
 * has(":checked", "bg-blue-50");   // => "has-[:checked]:bg-blue-50"
 * has("> img", "p-0");             // => "has-[>_img]:p-0"
 * has("input[type=text]", "ring-2");
 */
export function has(selector: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("has", selector, "has"), classes));
}

/**
 * Apply classes when the element does **not** contain anything matching `selector`.
 *
 * Note which negation this is. `notHas(":checked", …)` builds `not-has-[:checked]:`,
 * which compiles to `:not(:has(:is(:checked)))` — *no* checked descendant. Tailwind
 * also accepts `has-not-[:checked]`, which is `:has(:not(:is(:checked)))` — a
 * descendant that is *not* checked. Both compile and they mean different things; if
 * you want the second, write it as `has(":not(:checked)", …)`.
 *
 * @example
 * notHas(":checked", "opacity-50");  // => "not-has-[:checked]:opacity-50"
 */
export function notHas(selector: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("notHas", selector, "not-has"), classes));
}

/**
 * Apply classes when the element is **inside** something matching `selector`, via
 * Tailwind's `in-*` variant — the complement of {@link has}.
 *
 * Named `inside` because `in` is a reserved word. As with `has`, the plain state form
 * is already a key: `ss({ "in-focus": … })`.
 *
 * @example
 * inside(".dark", "text-white");            // => "in-[.dark]:text-white"
 * inside("[data-theme=dark]", "bg-black");  // => "in-[[data-theme=dark]]:bg-black"
 */
export function inside(selector: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor("inside", selector, "in"), classes));
}

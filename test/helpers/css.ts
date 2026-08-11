/**
 * Helpers for the end-to-end tests, which run tailess' output through the real
 * Tailwind compiler. Asserting on generated CSS is the only way to catch the
 * class of bug this package exists to avoid: a class name that lands on the
 * element but has no rule behind it.
 */

/**
 * How Tailwind escapes a class name inside a selector. Notably a leading digit
 * becomes a hex escape, so `2xl:flex` is emitted as `.\32 xl\:flex`.
 */
export function selectorFor(cls: string): string {
  let out = "";
  for (let i = 0; i < cls.length; i += 1) {
    const ch = cls[i] as string;
    if (i === 0 && ch >= "0" && ch <= "9") {
      out += `\\3${ch} `;
      continue;
    }
    out += /[a-zA-Z0-9_-]/.test(ch) ? ch : `\\${ch}`;
  }
  return `.${out}`;
}

/** True if `css` contains a rule for `cls`. */
export function hasRule(css: string, cls: string): boolean {
  return css.includes(selectorFor(cls));
}

/** Every class in `classes` that has no rule in `css`. */
export function missingRules(css: string, classes: readonly string[]): string[] {
  return classes.filter((cls) => !hasRule(css, cls));
}

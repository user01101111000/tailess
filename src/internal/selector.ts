/**
 * How Tailwind escapes a class name inside a selector.
 *
 * Needed anywhere a generated stylesheet has to be searched for a *class*, which is
 * the only assertion that can actually catch this package's failure mode: a class on
 * the element with no rule behind it. Unescaping the stylesheet instead would mean
 * reimplementing the other direction and getting it wrong somewhere else.
 *
 * Notably a leading digit becomes a hex escape, so `2xl:flex` is emitted as
 * `.\32 xl\:flex`.
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

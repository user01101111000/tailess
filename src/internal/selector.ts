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

/** What can continue a class name, so a match that ends in one is a longer class. */
const nameChar = /[\w-]/;

/**
 * True if `css` contains a rule for `cls`.
 *
 * The match has to end where the selector does. A plain `includes` says `xl` resolves
 * because `.xl\:text-2xl` starts the same way, and says `md:p-4` resolves because
 * `.md\:p-40` does — the first reports a healthy build, the second hides a broken one.
 * A backslash counts as a continuation too, since that is how the next `:` is escaped.
 */
export function hasRule(css: string, cls: string): boolean {
  const selector = selectorFor(cls);
  let at = css.indexOf(selector);
  while (at !== -1) {
    const next = css[at + selector.length];
    if (next === undefined || (next !== "\\" && !nameChar.test(next))) return true;
    at = css.indexOf(selector, at + 1);
  }
  return false;
}

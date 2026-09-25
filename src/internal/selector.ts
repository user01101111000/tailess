/**
 * How Tailwind escapes a class name inside a selector.
 *
 * Needed anywhere a generated stylesheet has to be searched for a *class*, which is
 * the only assertion that can actually catch this package's failure mode: a class on
 * the element with no rule behind it. Unescaping the stylesheet instead would mean
 * reimplementing the other direction and getting it wrong somewhere else.
 *
 * Notably a leading digit becomes a hex escape, so `2xl:flex` is emitted as
 * `.\32 xl\:flex`. Anything from U+0080 up is written as it is, as `CSS.escape` does
 * — `data-[state=geöffnet]:` keeps its `ö`, and an emoji its whole code point — and a
 * control character becomes a hex escape.
 */
export function selectorFor(cls: string): string {
  let out = "";
  let first = true;
  for (const ch of cls) {
    const code = ch.codePointAt(0) as number;
    if (first && ch >= "0" && ch <= "9") out += `\\3${ch} `;
    else if (code < 0x20 || code === 0x7f) out += `\\${code.toString(16)} `;
    else if (code >= 0x80 || /[a-zA-Z0-9_-]/.test(ch)) out += ch;
    else out += `\\${ch}`;
    first = false;
  }
  return `.${out}`;
}

/**
 * True if `ch` can continue a class name, so a match that ends in one is a longer class —
 * including a character past ASCII, which a selector carries unescaped.
 */
const continuesName = (ch: string): boolean =>
  /[\w-]/.test(ch) || (ch.codePointAt(0) as number) >= 0x80;

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
    if (next === undefined || (next !== "\\" && !continuesName(next))) return true;
    at = css.indexOf(selector, at + 1);
  }
  return false;
}

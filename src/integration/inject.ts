import { markerProperty } from "../internal/verify.js";

/**
 * Candidates per `@source inline(...)` directive. A single directive would work
 * fine — the limit only keeps the injected CSS from becoming one unreadable line
 * in devtools.
 */
const chunkSize = 200;

/** Custom property the runtime reads to confirm the integration is wired up. */
export { markerProperty };

/**
 * A `:root` rule the runtime can observe. Tailwind passes plain CSS through
 * untouched, so this survives compilation and lets a missing integration produce
 * a real error message instead of silently unstyled elements.
 */
export const markerRule = `:root{${markerProperty}:1}`;

/**
 * Split candidates into the quoted payloads of one or more `@source inline(…)`
 * directives, each ready to write between the parentheses.
 *
 * `@source inline()` is Tailwind's own safelist directive, so these candidates go
 * through the exact same pipeline as classes found in source: unknown ones are
 * ignored rather than fatal, and variants/theme values resolve identically.
 *
 * Double-quoted, except for candidates that carry a double quote themselves —
 * `after:content-["x"]` — which get single-quoted directives of their own. Tailwind
 * reads neither `\"` nor `\22` inside the string, so the other quote is the only
 * way to carry one; such a class used to be dropped, and was silently unstyled.
 */
export function sourceLiterals(classes: readonly string[]): string[] {
  const literals: string[] = [];
  const plain = classes.filter((cls) => !cls.includes('"'));
  const quoted = classes.filter((cls) => cls.includes('"'));
  for (const [list, quote] of [
    [plain, '"'],
    [quoted, "'"],
  ] as const) {
    for (let i = 0; i < list.length; i += chunkSize) {
      literals.push(`${quote}${list.slice(i, i + chunkSize).join(" ")}${quote}`);
    }
  }
  return literals;
}

/**
 * Where a stylesheet's leading block-less statements end: comments, `@charset`,
 * `@import`, `@layer a, b;`, `@namespace`, and Tailwind's own `@source`, `@plugin` or
 * `@config`. The injection goes there rather than at offset 0.
 *
 * CSS ignores an `@import` that follows a rule, and the injection carries one — the
 * marker. Prepended, it pushed a font's `@import url("https://fonts…")` behind
 * `:root{--tailess:1}`, and the font vanished from dev and production CSS alike.
 */
export function afterStatements(css: string): number {
  let end = 0;
  let i = 0;
  for (;;) {
    while (i < css.length) {
      if (/\s/.test(css[i] as string)) i += 1;
      else if (css.startsWith("/*", i)) {
        const close = css.indexOf("*/", i + 2);
        if (close === -1) return end;
        i = close + 2;
      } else break;
    }
    if (css[i] !== "@") return end;
    let depth = 0;
    let j = i + 1;
    for (; j < css.length; j += 1) {
      const c = css[j];
      if (c === '"' || c === "'") {
        // A font URL's query is full of `;` — `wght@400;700` — inside the quotes.
        let k = j + 1;
        while (k < css.length && css[k] !== c && css[k] !== "\n") k += css[k] === "\\" ? 2 : 1;
        j = k;
      } else if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
      else if (c === "{") return end;
      else if (c === ";" && depth <= 0) break;
    }
    if (j >= css.length) return end;
    end = j + 1;
    i = end;
  }
}

/**
 * Build the CSS to prepend to a Tailwind stylesheet: the marker rule plus a
 * `@source inline(...)` directive for every class tailess builds at runtime.
 */
export function buildPrelude(classes: readonly string[]): string {
  let css = `${markerRule}\n`;
  for (const literal of sourceLiterals(classes)) css += `@source inline(${literal});\n`;
  return css;
}

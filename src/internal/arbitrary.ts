import { firstTime, warn } from "./settings.js";

/**
 * The checks every helper that takes an *arbitrary value* needs.
 *
 * `supports`, `has`, `inside` and the `nth` family all put user text inside
 * `variant-[…]`, and they all fail the same three ways when that text cannot survive
 * the trip: an empty value builds `…-[]:`, which nothing generates a rule for; a
 * value carrying `{`, `}`, `\`, `;`, an unclosed quote or both kinds of quote is dropped
 * from the candidate list while the runtime still puts the class on the element; and a literal
 * `_` is decoded back into a space, so the rule that *is* generated says something
 * else than what was written.
 *
 * One implementation rather than one per helper, for the reason the escaping itself
 * is shared: a second copy is a second answer, and the two only have to disagree once.
 */

/** Values already inspected, so a warning in a render loop is printed once. */
const checked = new Set<string>();

/** Characters a class name cannot carry, so the build never enumerates them. */
const unusableChar = /[{}\\;]/;

/**
 * True when `value` cannot reach a rule. A lone `"` can — the plugin carries such a class
 * in a single-quoted `@source inline` — and flagging it warned on `[data-state="open"]`,
 * which works; an unclosed quote, or both kinds together, cannot be carried at all.
 */
function unusable(value: string): boolean {
  const singles = value.split("'").length - 1;
  const doubles = value.split('"').length - 1;
  return (
    unusableChar.test(value) ||
    singles % 2 === 1 ||
    doubles % 2 === 1 ||
    (singles > 0 && doubles > 0)
  );
}

/**
 * The custom-property *name* inside `var(…)` — the one place Tailwind keeps a `_`.
 * A fallback (`var(--a, my_value)`) is decoded like anything else, so only the name
 * is skipped when looking for a literal underscore.
 */
const varName = /var\(\s*--[\w-]+/g;

/**
 * Warn, in dev, about an arbitrary value that cannot become a working class.
 *
 * `noun` names what the helper calls its value, so the message reads the way the
 * caller thinks — "selector" for `has`, "feature query" for `supports`.
 *
 * Returns true when the value can produce no rule at all, so a caller with checks of
 * its own can stop there rather than piling a second message on the same mistake. A
 * literal underscore warns without returning true: that one still generates a rule,
 * it just generates the wrong one.
 */
export function warnUnusableValue(helper: string, noun: string, value: string): boolean {
  if (!firstTime(checked, `${helper} ${value}`)) return false;

  if (value === "") {
    warn(
      `[tailess] ${helper}() was given an empty ${noun}, which builds "…-[]:" — a ` +
        "class nothing ever generates a rule for.",
    );
    return true;
  }

  // A position is a number or `An+B`, never a string: `:nth-of-type("2n")` is a rule the
  // browser throws away, so a quote there is as fatal as an unusable character.
  const quoted = helper.startsWith("nth") && /["']/.test(value);
  if (quoted || unusable(value)) {
    warn(
      quoted
        ? `[tailess] ${helper}() positions are never quoted, so "${value}" builds a selector ` +
            "the browser discards."
        : `[tailess] the ${noun} "${value}" contains one of \`{ } \\ ;\`, an unclosed quote ` +
            "or both kinds of quote, which the build cannot carry, so it generates no rule for it.",
    );
    return true;
  }

  // A literal `_` is indistinguishable from the one these helpers write for a space,
  // and Tailwind decodes both — so `.my_class` silently becomes `.my class`.
  if (value.replace(varName, "").includes("_")) {
    warn(
      `[tailess] the ${noun} "${value}" has a literal underscore, which Tailwind reads ` +
        'as a space. Spaces are escaped for you; use withPrefix for a real "\\_".',
    );
  }

  return false;
}

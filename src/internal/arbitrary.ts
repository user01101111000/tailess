/**
 * The checks every helper that takes an *arbitrary value* needs.
 *
 * `supports`, `has`, `inside` and the `nth` family all put user text inside
 * `variant-[…]`, and they all fail the same three ways when that text cannot survive
 * the trip: an empty value builds `…-[]:`, which nothing generates a rule for; a
 * value carrying `"`, `{`, `}`, `\`, `;` or an unclosed `'` is dropped from the
 * candidate list while the runtime still puts the class on the element; and a literal
 * `_` is decoded back into a space, so the rule that *is* generated says something
 * else than what was written.
 *
 * One implementation rather than one per helper, for the reason the escaping itself
 * is shared: a second copy is a second answer, and the two only have to disagree once.
 */

/** Values already inspected, so a warning in a render loop is printed once. */
const checked = new Set<string>();

/** Characters a class name cannot carry, so the build never enumerates them. */
const unusableChar = /["{}\\;]/;

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
  const seen = `${helper} ${value}`;
  if (checked.has(seen)) return false;
  checked.add(seen);

  if (value === "") {
    console.warn(
      `[tailess] ${helper}() was given an empty ${noun}, which builds "…-[]:" — a ` +
        "class nothing ever generates a rule for.",
    );
    return true;
  }

  if (unusableChar.test(value) || (value.match(/'/g) ?? []).length % 2 === 1) {
    console.warn(
      `[tailess] the ${noun} "${value}" contains one of \`" { } \\ ;\` or an unclosed ` +
        "`'`, which cannot appear in a class name, so the build generates no rule for it.",
    );
    return true;
  }

  // A literal `_` is indistinguishable from the one these helpers write for a space,
  // and Tailwind decodes both — so `.my_class` silently becomes `.my class`.
  if (value.replace(varName, "").includes("_")) {
    console.warn(
      `[tailess] the ${noun} "${value}" has a literal underscore, which Tailwind reads ` +
        'as a space. Spaces are escaped for you; use withPrefix for a real "\\_".',
    );
  }

  return false;
}

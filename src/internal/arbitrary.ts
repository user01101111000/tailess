/**
 * The checks every helper that takes an *arbitrary value* needs.
 *
 * `supports`, `has`, `inside` and the `nth` family all put user text inside
 * `variant-[…]`, and they all fail the same two ways when that text cannot survive
 * the trip: an empty value builds `…-[]:`, which nothing generates a rule for, and a
 * value carrying `"`, `{`, `}`, `\`, `;` or an unclosed `'` is dropped from the
 * candidate list while the runtime still puts the class on the element.
 *
 * One implementation rather than one per helper, for the reason the escaping itself
 * is shared: a second copy is a second answer, and the two only have to disagree once.
 */

/** Values already inspected, so a warning in a render loop is printed once. */
const checked = new Set<string>();

/** Characters a class name cannot carry, so the build never enumerates them. */
const unusableChar = /["{}\\;]/;

/**
 * Warn, in dev, about an arbitrary value that cannot become a working class.
 *
 * `noun` names what the helper calls its value, so the message reads the way the
 * caller thinks — "selector" for `has`, "feature query" for `supports`.
 *
 * Returns true when it warned, so a caller with checks of its own can stop there
 * rather than piling a second message on the same mistake.
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

  return false;
}

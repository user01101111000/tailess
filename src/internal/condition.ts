/**
 * Rewrite a CSS feature query so it can live inside a class name.
 *
 * Tailwind reads an arbitrary variant value with `_` standing in for a space, so a
 * condition written the way CSS spells it — `display: grid` — has to be rewritten
 * before it can become a class name at all.
 *
 * This sits in `internal/` rather than beside the helper because *both* halves of
 * the package need it and they have to agree character for character: the runtime
 * builds the class, and the scanner has to predict the same string or the class
 * ships with no rule behind it. The repo already carries two spellings of this
 * substitution — `/\s/g` in `utils/prefix.ts`, `/\s+/g` in `extract/diagnose.ts` —
 * which agree on every single-space condition and diverge on `display:  grid`.
 * That is exactly the near-miss that reaches production, so there is one
 * implementation and both sides import it.
 *
 * One underscore per space, never per run: Tailwind decodes each `_` back to a
 * single space, so collapsing `  ` to one `_` would not round-trip.
 *
 * The trim matters more than it looks. A leading space becomes a leading `_`, and
 * Tailwind decides how to read the whole condition by testing it against
 * `/^[\w-]*\s*\(/` — so ` (display:grid)` and `(display:grid)` take different
 * branches of its parser and emit different CSS.
 */
const whitespace = /\s/g;

export function escapeCondition(condition: string): string {
  return condition.trim().replace(whitespace, "_");
}

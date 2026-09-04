import { escapeCondition } from "../internal/condition.js";
import { isDev } from "../internal/env.js";
import type { ClassValue } from "../types.js";
import { cn } from "./cn.js";
import { withPrefix } from "./prefix.js";

/**
 * Queries already inspected, so a warning in a render loop is printed once — and,
 * since a clean query is recorded too, so the checks below run once per distinct
 * query rather than on every render. Keyed on the negation as well: the same query
 * is fine under `supports` and a parse error under `notSupports`, so one cannot
 * vouch for the other. The separator is a space, which `escapeCondition` has already
 * removed from the query, so no two calls can collide on one key.
 */
const checkedConditions = new Set<string>();

/** Characters a class name cannot carry, so the build never enumerates them. */
const unusableChar = /["{}\\;]/;

/** `and` / `or` joining two feature queries. CSS keywords are case-insensitive. */
const combinator = /\b(?:and|or)\b/i;

/** Every `and` / `or` / `not` keyword, for reducing a shape down to its terms. */
const keywords = /\b(?:and|or|not)\b/gi;

/** A leading `not`, which CSS forbids combining with `and` / `or`. */
const leadingNot = /^not\b/i;

/**
 * The custom-property *name* inside `var(…)` — the one place Tailwind keeps a `_`.
 * A fallback (`var(--a, my_value)`) is decoded like anything else, so only the name
 * is skipped when looking for a literal underscore.
 */
const varName = /var\(\s*--[\w-]+/g;

/**
 * A condition with each top-level `(…)` group replaced by `#`.
 *
 * Whether a combined query works comes down to what sits *between* its terms, and
 * that cannot be read off the head of the string: `(a) and b` and `a and (b)` are
 * the same mistake and only one of them starts with a paren. Reducing the groups
 * away leaves exactly the top-level text, so `(a) and (b)` becomes `# and #`, and
 * anything left over besides the keywords is a term that was never parenthesised.
 *
 * Text before a `(` is kept, so a function call like `selector(&>*)` reduces to
 * `selector#` and is read as the single term it is rather than as a group.
 */
function outline(condition: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < condition.length; i += 1) {
    const ch = condition[i] as string;
    if (ch === "(") {
      if (depth === 0) out += "#";
      depth += 1;
    } else if (ch === ")") {
      if (depth > 0) depth -= 1;
    } else if (depth === 0) {
      out += ch;
    }
  }
  return out;
}

/**
 * Warn, in dev, about a query that cannot do what it says.
 *
 * Every case here is silent otherwise: the class name is built and lands on the
 * element, and whether the rule is merely false, discarded by the CSS parser, or
 * never generated at all, nothing reports a problem — the styles just never apply.
 */
function warnUnusableCondition(condition: string, negated: boolean): void {
  const seen = `${negated ? 1 : 0} ${condition}`;
  if (checkedConditions.has(seen)) return;
  checkedConditions.add(seen);

  if (condition === "") {
    console.warn(
      "[tailess] supports() was given an empty feature query, which builds " +
        '"supports-[]:…" — a class nothing ever generates a rule for.',
    );
    return;
  }

  // The build enumerates candidates by writing them into a stylesheet, so a query
  // carrying one of these cannot be enumerated at all: the class reaches the element
  // and no rule is ever generated for it.
  if (unusableChar.test(condition)) {
    console.warn(
      `[tailess] the feature query "${condition}" contains one of \`" { } \\ ;\`, which ` +
        "cannot appear in a class name, so the build generates no rule for it.",
    );
    return;
  }

  const shape = outline(condition);
  // Only a query with a parenthesised group can be a combined one. An `and` or `or`
  // anywhere else belongs to a value — `anchor-name: --or` is a single declaration —
  // and warning about those would fire on working code.
  if (shape.includes("#") && combinator.test(shape)) {
    // A top-level `not` beside `and`/`or` is a parse error, so the browser discards
    // the rule. `notSupports` puts one there whatever the query says.
    const invalidNot = negated || leadingNot.test(condition);
    if (invalidNot || shape.replace(/#/g, " ").replace(keywords, " ").trim() !== "") {
      console.warn(
        `[tailess] "${condition}" ` +
          (invalidNot
            ? 'combines a top-level "not" with "and"/"or", which is not valid CSS — the ' +
              'whole rule is dropped. Put the negation inside: supports("not ((a) and (b))", …).'
            : "combines queries without parenthesising each term, so it compiles to one " +
              'condition that is false in every browser. Write "(a) and (b)".'),
      );
      return;
    }
  }

  // A literal `_` is indistinguishable from the one this helper writes for a space,
  // and Tailwind decodes both — so `--my_var` silently becomes `--my var`.
  if (condition.replace(varName, "").includes("_")) {
    console.warn(
      `[tailess] the query "${condition}" has a literal underscore, which Tailwind ` +
        'reads as a space. Spaces are escaped for you; use withPrefix for a real "\\_".',
    );
  }
}

/** Build the prefix both helpers share. */
function prefixFor(condition: string, negated: boolean): string {
  const escaped = escapeCondition(condition);
  if (isDev) warnUnusableCondition(condition.trim(), negated);
  return negated ? `not-supports-[${escaped}]` : `supports-[${escaped}]`;
}

/**
 * Apply classes only when the browser supports a CSS feature, via Tailwind's
 * `supports-*` variant.
 *
 * Write the query the way CSS spells it — spaces and all. Tailwind needs a space
 * inside an arbitrary value written as `_`, and this does that for you, which is
 * the difference between a working class and one that is read as two class names
 * and styles nothing.
 *
 * A query with no `:` in it tests whether the *property* is understood at all, so
 * `supports("gap", …)` asks about `gap` support rather than any particular value.
 *
 * Combining queries needs every term in its own parentheses. A missing pair, a
 * top-level `not` beside an `and`, an empty query, and a character no class name can
 * carry all warn in development rather than styling nothing quietly.
 *
 * @example
 * supports("display: grid", "grid");     // => "supports-[display:_grid]:grid"
 * supports("gap", "gap-4");              // => "supports-[gap]:gap-4"
 * supports("(display:grid) and (gap:1rem)", "grid gap-4");
 */
export function supports(condition: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor(condition, false), classes));
}

/**
 * Apply classes only when the browser does **not** support a CSS feature — the
 * complement of {@link supports}, and the way to write a fallback.
 *
 * Note the spelling is `not-supports-*`. Tailwind has no `supports-not-*`: that
 * spelling produces no rule at all, or — for a query with no `:` — a rule testing a
 * property called `not-…`, which is never supported and so never applies.
 *
 * A combined query cannot be negated this way, because `@supports not (a) and (b)`
 * is not valid CSS. Put the negation inside the query instead:
 * `supports("not ((a) and (b))", …)`.
 *
 * @example
 * notSupports("display: grid", "flex");  // => "not-supports-[display:_grid]:flex"
 * notSupports("backdrop-filter: blur(1px)", "bg-white");
 */
export function notSupports(condition: string, classes: ClassValue): string {
  return cn(withPrefix(prefixFor(condition, true), classes));
}

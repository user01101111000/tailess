/**
 * Helpers for the end-to-end tests, which run tailess' output through the real
 * Tailwind compiler. Asserting on generated CSS is the only way to catch the
 * class of bug this package exists to avoid: a class name that lands on the
 * element but has no rule behind it.
 *
 * The escaping itself lives in `src/internal/selector.ts`, because `tailess check`
 * needs the same answer — a second copy here could drift from the one that ships,
 * and then the suite would be proving something the CLI does not do.
 */
import { hasRule } from "../../src/internal/selector.js";

export { hasRule, selectorFor } from "../../src/internal/selector.js";

/** Every class in `classes` that has no rule in `css`. */
export function missingRules(css: string, classes: readonly string[]): string[] {
  return classes.filter((cls) => !hasRule(css, cls));
}

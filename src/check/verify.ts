import { hasRule } from "../internal/selector.js";

/**
 * Turning the package's one promise into something a build can fail on.
 *
 * Everything else here proves the *bridge* works — the scanner enumerates what the
 * runtime builds, the plugin hands the list to Tailwind. None of it proves the far
 * end: that Tailwind actually generated a rule. A `@theme` that drops a breakpoint, a
 * `@config` this deliberately says nothing about, an arbitrary value Tailwind rejects,
 * or a future Tailwind that renames a variant all leave the bridge intact and the
 * element unstyled.
 *
 * So compile the project for real and look.
 */

/**
 * Split a candidate into the variant prefix and the utility it applies to.
 *
 * The split is at the last `:` that is not inside brackets — `supports-[display:_grid]`
 * is full of colons that are not separators, and getting this wrong would compare the
 * wrong halves.
 *
 * Returns `null` for a candidate with no prefix at all: those are literal in the
 * source, so Tailwind finds them without help and they are not this package's to
 * vouch for.
 */
export function splitCandidate(candidate: string): { prefix: string; utility: string } | null {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth -= 1;
    else if (ch === ":" && depth === 0) cut = i;
  }
  if (cut <= 0 || cut === candidate.length - 1) return null;
  return { prefix: candidate.slice(0, cut), utility: candidate.slice(cut + 1) };
}

/** A class the runtime can build for which the project's CSS has no rule. */
export interface BrokenClass {
  /** The full class, as it would land on the element. */
  candidate: string;
  /** The utility inside it, which does resolve — which is what makes this a defect. */
  utility: string;
}

/**
 * Every candidate whose utility resolves on its own but which has no rule with its
 * prefix attached.
 *
 * That comparison is the whole design. The scanner over-approximates on purpose, so
 * most of what it produces is junk — `md:state` from a `data()` name, `md:calc(100%`
 * from an argument that was never a class — and demanding a rule for *every* candidate
 * would report all of it. But a junk utility does not resolve bare either, so it drops
 * out. What is left is the case that matters: `p-4` works, `md:p-4` does not, and
 * something between the two is broken.
 */
export function findBroken(candidates: readonly string[], css: string): BrokenClass[] {
  const broken: BrokenClass[] = [];
  const resolves = new Map<string, boolean>();
  const check = (cls: string): boolean => {
    let known = resolves.get(cls);
    if (known === undefined) {
      known = hasRule(css, cls);
      resolves.set(cls, known);
    }
    return known;
  };

  for (const candidate of candidates) {
    const split = splitCandidate(candidate);
    if (split === null) continue;
    if (!check(split.utility)) continue;
    if (check(candidate)) continue;
    broken.push({ candidate, utility: split.utility });
  }

  return broken;
}

/**
 * The class list to compile so {@link findBroken} can ask both questions.
 *
 * Each candidate's bare utility goes in beside it, because "does `p-4` resolve" is
 * only answerable if `p-4` was offered to the compiler in the first place.
 */
export function probeList(candidates: readonly string[]): string[] {
  const out = new Set<string>(candidates);
  for (const candidate of candidates) {
    const split = splitCandidate(candidate);
    if (split !== null) out.add(split.utility);
  }
  return [...out];
}

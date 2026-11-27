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
 * One stylesheet, read at three points in one compiler's life.
 *
 * Tailwind's `build()` only ever adds: each call returns everything offered so far. So
 * offering nothing, then the bare utilities, then every candidate gives three answers
 * from a single compile — and the check needs all three, because a stylesheet holding
 * every candidate cannot say on its own which of its rules are *utilities*.
 */
export interface CompiledSheet {
  /** Every candidate offered: the answer to "does this class have a rule". */
  css: string;
  /**
   * Only the bare utilities offered: the answer to "does the utility resolve on its own".
   *
   * Asked of {@link css} instead, a selector some *other* candidate generated answered
   * for a class it merely mentions. `group-[.open]:rotate-90` compiles to
   * `…:is(:where(.group):is(.open) *)`, so `open` looked like a utility, and the junk
   * candidate `md:open` — the value of a `data()` call — failed a healthy build.
   */
  utilities?: string | undefined;
  /**
   * Nothing offered: the rules the stylesheet writes by hand.
   *
   * A class there is not a utility, whatever else it is. shadcn/ui's `.dark { … }` is the
   * common one: `dark` "resolved", so `md:dark` — junk from `on(["dark", "hover"], …)`
   * inside an `md` bucket — was reported, and the gate went red on working code. Tailwind
   * never puts a variant on a hand-written class either, so there is nothing to vouch
   * for there in the first place.
   */
  baseline?: string | undefined;
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
export function findBroken(
  candidates: readonly string[],
  css: string | CompiledSheet,
): BrokenClass[] {
  return findBrokenAcross(candidates, [css]);
}

type Answer = "css" | "utilities" | "baseline";

/**
 * {@link findBroken} over several stylesheets: a class is broken when at least one of
 * them resolves its utility and none of them has its rule.
 *
 * A stylesheet vouches for a class only by *containing its rule*. Counting a class as
 * broken only when every stylesheet failed it let one that generates nothing — a reset
 * file, a theme-only partial, a v3 `@tailwind` leftover — clear every broken class in
 * the project, since a candidate whose utility does not resolve is never "failed".
 *
 * A plain string is a stylesheet read once, with every candidate offered: it answers
 * all three questions, as it did before {@link CompiledSheet} existed.
 */
export function findBrokenAcross(
  candidates: readonly string[],
  sheets: ReadonlyArray<string | CompiledSheet>,
): BrokenClass[] {
  const parts: CompiledSheet[] = sheets.map((sheet) =>
    typeof sheet === "string" ? { css: sheet } : sheet,
  );
  const memo = parts.map(() => new Map<string, boolean>());

  const has = (i: number, answer: Answer, cls: string): boolean => {
    const part = parts[i] as CompiledSheet;
    const text =
      answer === "css"
        ? part.css
        : answer === "utilities"
          ? (part.utilities ?? part.css)
          : part.baseline;
    if (text === undefined) return false;
    const key = `${answer} ${cls}`;
    const seen = memo[i] as Map<string, boolean>;
    let known = seen.get(key);
    if (known === undefined) {
      known = hasRule(text, cls);
      seen.set(key, known);
    }
    return known;
  };

  const resolves = (utility: string): boolean =>
    parts.some((_, i) => has(i, "utilities", utility) && !has(i, "baseline", utility));
  const ruled = (cls: string): boolean => parts.some((_, i) => has(i, "css", cls));

  const broken: BrokenClass[] = [];
  for (const candidate of candidates) {
    const split = splitCandidate(candidate);
    if (split === null) continue;
    if (!resolves(split.utility)) continue;
    if (ruled(candidate)) continue;
    broken.push({ candidate, utility: split.utility });
  }

  return broken;
}

/**
 * A class every stylesheet that generates utilities at all has a rule for — the test
 * for a stylesheet that generates none, and so can say nothing about any class.
 */
export const utilitySentinel = "flex";

/**
 * The class list to compile so {@link findBroken} can ask both questions.
 *
 * Each candidate's bare utility goes in beside it, because "does `p-4` resolve" is
 * only answerable if `p-4` was offered to the compiler in the first place.
 */
export function probeList(candidates: readonly string[]): string[] {
  return [...new Set<string>([...candidates, ...utilityList(candidates)])];
}

/** Each candidate's bare utility, once — what {@link CompiledSheet.utilities} is built from. */
export function utilityList(candidates: readonly string[]): string[] {
  const out = new Set<string>();
  for (const candidate of candidates) {
    const split = splitCandidate(candidate);
    if (split !== null) out.add(split.utility);
  }
  return [...out];
}

import { twMerge } from "tailwind-merge";
import { screenKeys } from "../constants.js";
import { extractStrings, isArrayLiteral, type RawCall, scanCalls } from "./scan.js";

/**
 * Problems the scanner can prove from the source alone, reported while the project
 * builds rather than when a component happens to render.
 *
 * The runtime warns about most of these too, but only once the line executes, only
 * in a browser, and only with a console open — so a call on a branch that did not
 * run during development ships unnoticed. Everything here is visible statically, so
 * it is checked for every call site on every build, and shows up in CI.
 *
 * The bar is deliberately high: a diagnostic is emitted only when the code *cannot*
 * work, never when it merely looks unusual. A warning that fires on working code
 * teaches people to ignore warnings.
 */
export interface Diagnostic {
  /** Machine-readable category, so a caller can group or filter. */
  kind: "dead-class" | "empty-range" | "blank-prefix" | "spaced-prefix";
  /** One line, written for whoever has to fix it. */
  message: string;
}

const whitespace = /\s/;

/** Normalize a class string to a stable token list, so comparison ignores spacing. */
function tokens(literal: string): string[] {
  return literal.split(/\s+/).filter(Boolean);
}

/**
 * The classes in `literal` that `tailwind-merge` removes.
 *
 * Only ever called on a *single* string literal, which is what makes the finding
 * safe to report: every token in one literal is unconditionally present, so a token
 * the merge drops can never reach the element — no prop, no branch and no argument
 * order can bring it back. Two literals in an array, or a later argument, are a
 * different matter entirely: there the override is the point, and this never looks
 * at them.
 */
function droppedBy(literal: string): string[] {
  const written = tokens(literal);
  if (written.length < 2) return [];
  const kept = new Set(tokens(twMerge(written.join(" "))));
  return written.filter((cls) => !kept.has(cls));
}

/**
 * The kept class that displaced `dropped`.
 *
 * `tailwind-merge` reports what survives, not what beat what, so ask it pairwise:
 * the winner is the one class that still swallows `dropped` on its own. Naming it
 * is the difference between a message you can act on and one you have to decode.
 */
function replacedBy(dropped: string, kept: readonly string[]): string | undefined {
  return kept.find((candidate) => twMerge(`${dropped} ${candidate}`) === candidate);
}

/** Report every class in `text`'s own string literals that the merge would discard. */
function deadClasses(text: string | undefined, report: (d: Diagnostic) => void): void {
  if (!text) return;
  for (const literal of extractStrings(text)) {
    const dropped = droppedBy(literal);
    if (dropped.length === 0) continue;
    const kept = tokens(twMerge(tokens(literal).join(" ")));
    for (const cls of dropped) {
      const winner = replacedBy(cls, kept);
      report({
        kind: "dead-class",
        message:
          `"${cls}" never reaches the element` +
          (winner ? ` — "${winner}" replaces it in the same string` : "") +
          `. Drop the unused one, or move the override into its own argument.`,
      });
    }
  }
}

/** Report a prefix that cannot form a working class name. */
function checkPrefix(text: string | undefined, report: (d: Diagnostic) => void): void {
  if (!text) return;
  for (const prefix of extractStrings(text)) {
    if (prefix === "") {
      report({
        kind: "blank-prefix",
        message:
          "withPrefix() was given an empty prefix. The classes come back unprefixed, " +
          'since ":class" would match nothing.',
      });
      continue;
    }
    if (whitespace.test(prefix)) {
      report({
        kind: "spaced-prefix",
        message:
          `the variant prefix "${prefix}" contains whitespace, so it is read as two ` +
          `class names and neither means anything. Tailwind spells a space inside an ` +
          `arbitrary value as "_" — "${prefix.replace(/\s+/g, "_")}".`,
      });
    }
  }
}

/** Inspect one call. */
function check(call: RawCall, report: (d: Diagnostic) => void): void {
  const { name, args } = call;

  switch (name) {
    case "between": {
      if (args.length < 3) return;
      const order = screenKeys as readonly string[];
      for (const min of extractStrings(args[0] ?? "")) {
        for (const max of extractStrings(args[1] ?? "")) {
          if (!order.includes(min) || !order.includes(max)) continue;
          if (order.indexOf(min) < order.indexOf(max)) continue;
          report({
            kind: "empty-range",
            message:
              `between("${min}", "${max}", …) describes an empty range: "${min}" is not ` +
              `narrower than "${max}", so "${min}:max-${max}:" can never match a viewport. ` +
              `Did you mean between("${max}", "${min}", …)?`,
          });
        }
      }
      deadClasses(args[2], report);
      return;
    }

    case "withPrefix": {
      if (args.length < 2) return;
      checkPrefix(args[0], report);
      deadClasses(args[1], report);
      return;
    }

    case "data": {
      if (args.length < 3) return;
      // A space in either half lands inside `data-[name=value]`, which then reads as
      // two class names — the same failure a spaced prefix has.
      for (const part of [args[0], args[1]]) {
        for (const value of extractStrings(part ?? "")) {
          if (!whitespace.test(value)) continue;
          report({
            kind: "spaced-prefix",
            message:
              `data(…, "${value}", …) puts whitespace inside the variant, so the class ` +
              `splits in two and neither half matches. Write the space as "_": ` +
              `"${value.replace(/\s+/g, "_")}".`,
          });
        }
      }
      deadClasses(args[2], report);
      return;
    }

    case "on": {
      if (args.length < 2) return;
      // A state array joins with `:`, so an empty entry yields `dark::underline`.
      if (isArrayLiteral(args[0] ?? "")) {
        for (const state of extractStrings(args[0] ?? "")) {
          if (state !== "") continue;
          report({
            kind: "blank-prefix",
            message:
              "on([…]) contains an empty state, so the prefixes join into `::` and the " +
              "class matches nothing. Remove the empty entry.",
          });
        }
      }
      deadClasses(args[1], report);
      return;
    }

    case "until":
    case "aria": {
      deadClasses(args[1], report);
      return;
    }

    case "ss":
    case "responsive": {
      // Every argument of these is (or contains) class values; the literals inside
      // are what matter, and `extractStrings` reaches them wherever they sit.
      for (const arg of args) deadClasses(arg, report);
      return;
    }
  }
}

/**
 * How many problems one file may report before the rest are summarised.
 *
 * A hand-written file never comes close. A generated one can: a single string holding
 * a few thousand utilities is almost entirely conflicting, and naming each would bury
 * the build output — and every other file's findings with it. The count still gets
 * through, so nothing is hidden, only shortened.
 */
const maxPerFile = 20;

/** Every problem the scanner can prove from `code`. */
export function diagnose(code: string): Diagnostic[] {
  const found: Diagnostic[] = [];
  const seen = new Set<string>();
  let suppressed = 0;

  const report = (d: Diagnostic): void => {
    // One call site written twice in a file is one problem, not two.
    const key = `${d.kind} ${d.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (found.length >= maxPerFile) {
      suppressed += 1;
      return;
    }
    found.push(d);
  };

  for (const call of scanCalls(code)) check(call, report);

  if (suppressed > 0) {
    found.push({
      kind: "dead-class",
      message:
        `and ${suppressed} more problem${suppressed === 1 ? "" : "s"} in this file, not ` +
        "listed. Fixing the ones above usually clears the rest.",
    });
  }
  return found;
}

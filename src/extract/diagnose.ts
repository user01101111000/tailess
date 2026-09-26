import { twMerge } from "tailwind-merge";
import { maxScreenKeys, screenKeys, stateKeys } from "../constants.js";
import { uncarriedClasses } from "./extract.js";
import {
  arrayBody,
  declaresKey,
  dictionaryKeys,
  extractStrings,
  helperNames,
  inertCode,
  isArrayLiteral,
  maskLiterals,
  objectLiterals,
  parseObject,
  type RawCall,
  scanCalls,
  scanMatchCalls,
  splitArgs,
} from "./scan.js";

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
  kind:
    | "dead-class"
    | "empty-range"
    | "blank-prefix"
    | "spaced-prefix"
    | "unusable-query"
    /** Not from a source file: the project's CSS redefines `--breakpoint-*`. */
    | "theme-drift"
    /** Not from a source file either: Tailwind was imported with a `prefix(…)`. */
    | "unsupported-prefix"
    /** A helper imported under another name, which the scanner cannot follow. */
    | "renamed-import"
    /** An `ss` map handed to a helper whose class argument is a clsx value. */
    | "bucket-as-dictionary"
    /** A prefixed bucket whose value the scanner cannot read. */
    | "dynamic-value"
    /** A prefixed class with a `{`, `}` or `\` in it, which cannot reach Tailwind. */
    | "uncarried-class";
  /** One line, written for whoever has to fix it. */
  message: string;
  /**
   * A note about CSS that works — a breakpoint or variant the theme adds, a width it
   * moves — rather than a class that cannot. Printed like the rest, but it never fails a
   * build under `diagnostics: "error"` or `check --strict`.
   */
  informational?: true;
}

const whitespace = /\s/;

/** Characters a class name cannot carry, so the build can never enumerate them. */
const unusableInClassName = /[{}\\;]/;

/**
 * True when an arbitrary value cannot reach a rule. A lone `"` can: the plugin carries
 * such a class in a single-quoted `@source inline`, and reporting it failed
 * `--strict` over `has('[data-state="open"]', …)`, which works. An unclosed quote, or
 * both kinds together, cannot be carried at all. The runtime's copy is in
 * `internal/arbitrary.ts`; the runtime bundle cannot import from here.
 */
function unusableValue(value: string): boolean {
  const singles = value.split("'").length - 1;
  const doubles = value.split('"').length - 1;
  return (
    unusableInClassName.test(value) ||
    singles % 2 === 1 ||
    doubles % 2 === 1 ||
    (singles > 0 && doubles > 0)
  );
}

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

/** Every key `ss` knows, for telling a bucket map from a `clsx` dictionary. */
const everyKey = new Set<string>(["base", ...screenKeys, ...maxScreenKeys, ...stateKeys]);

/**
 * The keys that are also plausible class names of someone's own.
 *
 * A dash rules it out: nobody writes a class called `group-hover` or `max-md`, and a
 * breakpoint is not a class name either. What is left — `first`, `last`, `open`,
 * `checked`, `disabled`, `active` — is exactly the vocabulary of a `clsx` dictionary
 * (`.active` in Bootstrap, `.open` in a CSS module), so for those the report has to name
 * both readings instead of asserting the one that happens to be more common.
 */
const ambiguousAsClass = new Set<string>(
  stateKeys.filter((key) => !key.includes("-") && !(screenKeys as readonly string[]).includes(key)),
);

/**
 * Report an `ss` map handed to a helper that takes a flat class value.
 *
 * Composition here runs one way: a helper nests *inside* an `ss` bucket, not the other
 * way round. `on`, `until`, `supports` and the rest take a `ClassValue`, where an object
 * is a `clsx` dictionary — `until("md", { hidden: !open })` is the documented shape — so
 * an `ss` map handed to one is read as a dictionary and its *keys* become the classes:
 * `on("hover", { base: "underline", md: "font-bold" })` builds `"hover:base hover:md"`.
 *
 * The type system cannot refuse it: a clsx dictionary is any object, so an `ss` map is
 * one too. The runtime is silent, which is why it is worth a build check. The test is
 * exact: `base`, `md` and `hover` are `ss` keys and none of them is a Tailwind utility,
 * so a dictionary key that is one of them was meant as a bucket.
 *
 * `fix` is the rewrite to offer, given the key: for the prefixing helpers it is nesting
 * the other way round; for a value of `responsive` or `match` it is wrapping it in `ss`.
 */
function bucketMapAsDictionary(
  name: string,
  text: string | undefined,
  report: (d: Diagnostic) => void,
  fix: (key: string) => string = (key) => `Nest the other way round: ss({ ${key}: ${name}(…) }).`,
): void {
  if (!text) return;
  // Spelled-out entries only. `({ open, dark }) => …` is a destructuring parameter, not a
  // dictionary, and it is the commonest object literal in a component file.
  for (const key of dictionaryKeys(text, true, false)) {
    if (!everyKey.has(key)) continue;
    report({
      kind: "bucket-as-dictionary",
      message:
        `${name}() was given an object with the key "${key}", which is an ss bucket — but ` +
        `its class argument is a clsx value, so "${key}" becomes the class name. ` +
        fix(key) +
        // `first`, `last`, `open`, `checked`, `disabled` are ordinary conditional class
        // names — Bootstrap's `.active`, a CSS module's `.open` — so the nesting mistake
        // is not the only way to land here. The class is dead either way, but only one of
        // the two readings has the rewrite above as its fix, and asserting the wrong one
        // sends the reader to change code that was doing what they meant.
        (ambiguousAsClass.has(key)
          ? ` If "${key}" really is your own class name, it is not the nesting that is ` +
            `wrong — it still takes the ${name}() prefix, and nothing generates a rule ` +
            `for "${key}".`
          : ""),
    });
    return;
  }
}

/** Values that contribute no class at all, so being unreadable costs nothing. */
const contributesNothing = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "void 0",
  "0",
  '""',
  "''",
  "``",
]);

/**
 * The index of the first top-level `op` in `blank` — the value with its strings and
 * comments masked — or -1. Top level means outside every `()`, `[]` and `{}`.
 */
function topLevel(blank: string, op: RegExp): number {
  let depth = 0;
  for (let i = 0; i < blank.length; i += 1) {
    const c = blank[i];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (depth === 0 && op.test(blank.slice(i, i + 2))) return i;
  }
  return -1;
}

/**
 * The parts of a bucket value that become classes.
 *
 * Both branches of a ternary, both sides of `||` and `??`, the last of an `&&` chain —
 * the ones before it are conditions — and every element of an array. A literal anywhere
 * used to vouch for the whole value, so `cond ? size : "p-2"`, `[size, "flex"]` and
 * `size ?? "p-2"` all read as fine while `size` built a class nothing enumerated.
 */
function operands(value: string): string[] {
  const text = value.trim();
  if (isArrayLiteral(text)) return splitArgs(arrayBody(text)).flatMap(operands);
  const blank = maskLiterals(text, true);
  if (text.startsWith("(") && closing(blank) === blank.length - 1) {
    return operands(text.slice(1, -1));
  }
  const split = ternary(blank);
  if (split) {
    const [question, colon] = split;
    return [...operands(text.slice(question + 1, colon)), ...operands(text.slice(colon + 1))];
  }
  for (const [op, keepAll] of [
    [/^(?:\|\||\?\?)/, true],
    [/^&&/, false],
  ] as const) {
    const at = topLevel(blank, op);
    if (at === -1) continue;
    const right = operands(text.slice(at + 2));
    return keepAll ? [...operands(text.slice(0, at)), ...right] : right;
  }
  return [text];
}

/** Where the bracket opening `blank` closes, or -1. */
function closing(blank: string): number {
  let depth = 0;
  for (let i = 0; i < blank.length; i += 1) {
    const c = blank[i];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if ((c === ")" || c === "]" || c === "}") && --depth === 0) return i;
  }
  return -1;
}

/**
 * The top-level `?` of a ternary in `blank` and the `:` that closes it, or `undefined`.
 * `?.` and `??` are not ternaries; a nested ternary's `:` is its own.
 */
function ternary(blank: string): [question: number, colon: number] | undefined {
  let depth = 0;
  let question = -1;
  let nested = 0;
  for (let i = 0; i < blank.length; i += 1) {
    const c = blank[i];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (depth !== 0) continue;
    else if (c === "?") {
      if (blank[i + 1] === "." || blank[i + 1] === "?" || blank[i - 1] === "?") continue;
      if (question === -1) question = i;
      else nested += 1;
    } else if (c === ":" && question !== -1) {
      if (nested === 0) return [question, i];
      nested -= 1;
    }
  }
  return undefined;
}

/** A bare identifier: a shorthand property, `{ md }`, is `md: md`. */
const identifier = /^[A-Za-z_$][\w$]*$/;

/**
 * Report a bucket whose value the scanner cannot read.
 *
 * The README lists these as things the scanner cannot see — a variable, an interpolated
 * template, a call it does not know — and every one of them is silent: the runtime
 * builds `md:p-4` from whatever the value turns out to be, and no candidate was ever
 * enumerated for it, so the class lands with no rule. It is the package's most common
 * support case and the type system cannot express any of it, because `ss({ md: size })`
 * is perfectly well typed.
 *
 * Only a *prefixed* bucket is reported. `base` adds no prefix, so its value passes
 * through unchanged and Tailwind finds the literal wherever it really lives — which is
 * why the same shape there is fine, and reporting it would be a warning on working code.
 * A `base` inside a prefixed map is prefixed all the same — `{ md: { base: size } }` is
 * `md:<size>` — and a value that is itself a map is walked, since the bucket that cannot
 * be read may be the one nested inside it.
 *
 * `nested` is false where a value is a flat class value rather than an `ss` argument —
 * `responsive`'s breakpoints — since an object there is a clsx dictionary, whose
 * `{ hidden: !open }` is a condition, not a bucket.
 */
function dynamicBuckets(
  text: string | undefined,
  report: (d: Diagnostic) => void,
  underPrefix = false,
  nested = true,
): void {
  if (!text) return;
  const unreadable = (key: string, trimmed: string, part: string) =>
    report({
      kind: "dynamic-value",
      message:
        `the "${key}" bucket is set to \`${trimmed}\`` +
        (part === trimmed ? "" : `, and \`${part}\` in it`) +
        ", which the scanner cannot read — so nothing enumerates the class it builds and it " +
        "reaches the element with no rule. Keep the class literal at the call site: " +
        `match(${part}, { … }) for a lookup, or vars() when the value is a number.`,
    });
  for (const map of objectLiterals(text)) {
    // `{ … } as { md: string }` and `(x: { md: string }) => …`: a type, whose `string` is
    // not a value, let alone an unreadable one. The colon has to follow a parameter name:
    // `cond ? { … } : { md: size }` is the other branch of a ternary, and is read.
    const before = text.slice(0, text.indexOf(map));
    if (/(?:\bas|\bsatisfies|[(,]\s*[\w$]+\??\s*:)\s*$/.test(before)) continue;
    for (const { key, value } of parseObject(map)) {
      const prefixed = underPrefix || key !== "base";
      if (objectLiterals(value).length > 0 && !isArrayLiteral(value.trim())) {
        if (nested) dynamicBuckets(value, report, prefixed);
        continue;
      }
      if (!prefixed) continue;
      const trimmed = value.trim();
      // Each part that becomes a class has to be readable on its own — a literal in the
      // other branch builds a different class, and says nothing about this one. A known
      // helper's call is its own call, read where it stands; an object in an array is a
      // clsx dictionary, whose keys are the classes.
      for (const part of operands(trimmed)) {
        if (part === "" || contributesNothing.has(part) || extractStrings(part).length > 0)
          continue;
        if (part.startsWith("{") || helperCall.test(part)) continue;
        unreadable(key, trimmed, part);
        break;
      }
    }
    // `parseObject` skips shorthand, and `{ base: "p-1", md }` is `md: md` — a variable
    // under a prefix, as unreadable as any other.
    const body = map.trim().slice(1, map.trim().lastIndexOf("}"));
    for (const entry of splitArgs(body)) {
      const name = entry.trim();
      if (!identifier.test(name) || !everyKey.has(name)) continue;
      if (name !== "base" || underPrefix) unreadable(name, name, name);
    }
  }
}

/** A call to a helper the scanner reads, which it enumerates where it stands. */
const helperCall = new RegExp(`^(?:${helperNames.join("|")})\\s*\\(`);

/** What each helper that writes into `…-[…]` calls the text it puts there. */
const arbitraryNoun: Record<string, string> = {
  supports: "feature query",
  notSupports: "feature query",
  has: "selector",
  notHas: "selector",
  inside: "selector",
  nth: "position",
  nthLast: "position",
  nthOfType: "position",
  nthLastOfType: "position",
};

/**
 * Report an arbitrary value that cannot survive the trip into a class name.
 *
 * The candidate list is written into a stylesheet, so a value carrying one of these
 * cannot be enumerated at all — while the runtime still builds the class. That is the
 * failure this package exists to prevent, and it is the one case `tailess check` cannot
 * catch either: the candidate never reaches the compiler to be found missing.
 */
function unusableValues(name: string, arg: string, report: Report): void {
  const noun = arbitraryNoun[name] as string;
  for (const literal of extractStrings(arg)) {
    const value = literal.trim();
    if (value === "") {
      report({
        kind: "unusable-query",
        message:
          `${name}("", …) has an empty ${noun}, so it builds "…-[]:" — a class nothing ` +
          "generates a rule for.",
      });
    } else if (name.startsWith("nth") && /["']/.test(value)) {
      // A position is a number or `An+B`, never a string: `:nth-of-type("2n")` is a
      // rule the browser throws away.
      report({
        kind: "unusable-query",
        message: `${name}(${literal}, …) quotes its position, so it builds a selector the browser discards.`,
      });
    } else if (unusableValue(value)) {
      report(
        {
          kind: "unusable-query",
          message:
            `${name}("${value}", …) has a ${noun} containing one of \`{ } \\ ;\`, an unclosed ` +
            "quote or both kinds of quote, which the build cannot carry, so the class is " +
            "built but no rule is generated for it.",
        },
        value,
      );
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
/**
 * Where a check sends what it found. `value` is an arbitrary value already reported as
 * one the build cannot carry, so the class built from it is not reported a second time.
 */
type Report = (d: Diagnostic, value?: string) => void;

function check(call: RawCall, report: Report): void {
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
      bucketMapAsDictionary(name, args[2], report);
      return;
    }

    case "withPrefix": {
      if (args.length < 2) return;
      checkPrefix(args[0], report);
      deadClasses(args[1], report);
      bucketMapAsDictionary(name, args[1], report);
      return;
    }

    // Every helper whose first argument becomes the inside of a `…-[…]`, and whose
    // second is the class value. One shape, one pair of checks.
    case "supports":
    case "notSupports":
    case "has":
    case "notHas":
    case "inside":
    case "nth":
    case "nthLast":
    case "nthOfType":
    case "nthLastOfType": {
      if (args.length < 2) return;
      unusableValues(name, args[0] ?? "", report);
      deadClasses(args[1], report);
      bucketMapAsDictionary(name, args[1], report);
      return;
    }

    // The named variants: the name is checked at runtime, where the rules differ per
    // helper; the class value is the same everywhere.
    case "group":
    case "peer":
    case "container": {
      if (args.length < 3) return;
      deadClasses(args[2], report);
      bucketMapAsDictionary(name, args[2], report);
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
      bucketMapAsDictionary(name, args[2], report);
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
      bucketMapAsDictionary(name, args[1], report);
      return;
    }

    case "until":
    case "aria": {
      deadClasses(args[1], report);
      bucketMapAsDictionary(name, args[1], report);
      return;
    }

    case "ss":
    case "responsive": {
      // Every argument of these is (or contains) class values; the literals inside
      // are what matter, and `extractStrings` reaches them wherever they sit.
      // No `bucketMapAsDictionary` here: for these two an object argument really is a
      // bucket map, which is the whole point of them — and is what makes it the one
      // place a bucket the scanner cannot read is worth reporting.
      for (const arg of args) {
        deadClasses(arg, report);
        dynamicBuckets(arg, report, false, name === "ss");
      }
      // A breakpoint's value is a flat class value, not another map:
      // `responsive("p-2", { md: { hover: "p-4" } })` builds `md:hover`, which no
      // utility matches, so `check` skips it as junk and nothing else says a word.
      if (name === "responsive") {
        for (const map of objectLiterals(args[1] ?? "")) {
          for (const { key, value } of parseObject(map)) {
            bucketMapAsDictionary(
              name,
              value,
              report,
              (inner) => `Write the stack as a map: ss({ ${key}: { ${inner}: "…" } }).`,
            );
          }
        }
      }
      return;
    }

    // The same mistake in a lookup: `match(size, { sm: { md: "p-4" } })` builds `md`.
    case "match": {
      for (const map of objectLiterals(args[1] ?? "")) {
        for (const { value } of parseObject(map)) {
          bucketMapAsDictionary(
            name,
            value,
            report,
            (inner) => `Wrap the option in ss(): { …: ss({ ${inner}: "…" }) }.`,
          );
        }
      }
      return;
    }

    // A recipe keeps its class values in four places — base, slots, each option, each
    // compound rule — and each is an `ss` argument, or with slots a map of them. They
    // were never looked at, so `{ lg: { md: size } }`, the shape a responsive option
    // naturally takes, shipped `md:<size>` with no rule and no word.
    case "variants": {
      const first = objectLiterals(args[0] ?? "")[0];
      const isConfig = first !== undefined && declaresKey(first, "variants");
      const cva = args.length > 1 && !isConfig;
      if (cva) dynamicBuckets(args[0], report);
      // A lone argument with no `variants` key is a base, as the scanner reads it.
      if (args.length === 1 && !isConfig) {
        dynamicBuckets(args[0], report);
        return;
      }
      const [config] = objectLiterals(args[cva ? 1 : 0] ?? "");
      if (config === undefined) return;
      // The same test the scanner uses for whether option values are one level deeper.
      const slotted = declaresKey(config, "slots");
      const classValue = (text: string): void => {
        if (!slotted) {
          dynamicBuckets(text, report);
          return;
        }
        for (const parts of objectLiterals(text)) {
          for (const part of parseObject(parts)) dynamicBuckets(part.value, report);
        }
      };
      for (const { key, value } of parseObject(config)) {
        if (key === "base") dynamicBuckets(value, report);
        else if (key === "slots") {
          for (const parts of objectLiterals(value)) {
            for (const part of parseObject(parts)) dynamicBuckets(part.value, report);
          }
        } else if (key === "variants") {
          for (const groups of objectLiterals(value)) {
            for (const group of parseObject(groups)) {
              for (const options of objectLiterals(group.value)) {
                for (const option of parseObject(options)) classValue(option.value);
              }
            }
          }
        } else if (key === "compound" || key === "compoundVariants") {
          for (const rule of objectLiterals(arrayBody(value))) {
            for (const field of parseObject(rule)) {
              if (field.key === "class" || field.key === "className") classValue(field.value);
            }
          }
        }
      }
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

/**
 * Files where an `import` line is prose rather than code.
 *
 * The scanner reads Markdown and HTML because a class can appear in either, but the
 * import statements there are examples — a README documenting `import { ss as tw }` as
 * the thing *not* to do would otherwise be reported for doing it. `.mdx` is excluded
 * from this list on purpose: its imports really do run.
 */
const proseFile = /\.(?:md|markdown|html?)$/i;

/**
 * Each way a file can bind a tailess helper under a name of its own: the statement, how
 * one specifier in its list renames, and what the message calls it.
 *
 * A statement starts a line or follows a `;` — `"use client"; import { ss as tw } …` and
 * a minified `import{ss as t}from"tailess"` are both imports. `import type` binds nothing
 * callable, so it is not one of these.
 */
const renamings: [statement: RegExp, specifier: RegExp, verb: string][] = [
  [
    /(?:^|;)[ \t]*(import)\s*\{([^}]*)\}\s*from\s*["']tailess["']/gm,
    /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/,
    "imported",
  ],
  [
    /(?:^|;)[ \t]*(export)\s*\{([^}]*)\}\s*from\s*["']tailess["']/gm,
    /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/,
    "re-exported",
  ],
  [
    /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(require)\(\s*["']tailess["']\s*\)/g,
    /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/,
    "required",
  ],
];
const scannedHelpers = new Set<string>(helperNames);

/**
 * Report a helper imported under another name.
 *
 * The scanner finds calls by identifier, so `import { ss as tw } from "tailess"` is one
 * line that removes *every* class in the file from the candidate list. Nothing else
 * notices: the file compiles, type-checks, renders the right `class` attribute, and
 * every variant on it is unstyled. It is the largest silent failure the package has and
 * the only one provable from the import statement alone.
 *
 * `code` here is the masked source, and `blank` the same with strings blanked too: a
 * commented-out import, one quoted inside a docs sample and one inside a string are all
 * what they are — text about code. This check asserts the strongest failure the package
 * reports, and asserting it about a line that does not run — in the same output that says
 * every class has CSS — is how a build gate teaches people to stop reading it.
 *
 * A re-export is the form the old message recommended, and renaming there is worse, not
 * better: every file that imports the new name loses its classes, and none of them has a
 * rename in it to be reported.
 */
function renamedImports(code: string, blank: string, report: (d: Diagnostic) => void): void {
  for (const [statement, specifier, verb] of renamings) {
    statement.lastIndex = 0;
    for (let m = statement.exec(code); m !== null; m = statement.exec(code)) {
      const keyword = m[1] === "import" || m[1] === "export" ? m[1] : "const";
      const list = (keyword === "const" ? m[1] : m[2]) as string;
      // Inside a string, the keyword is blanked: `"…; import { ss as tw } from …"` is data.
      const at = m.index + m[0].indexOf(keyword === "const" ? "{" : keyword);
      if (blank[at] !== code[at]) continue;
      for (const entry of list.split(",")) {
        const found = specifier.exec(entry.trim());
        if (!found) continue;
        const original = found[1] as string;
        const local = found[2] as string;
        if (!scannedHelpers.has(original) || original === local) continue;
        report({
          kind: "renamed-import",
          message:
            verb === "re-exported"
              ? `${original}() is re-exported as "${local}", and the scanner finds calls by ` +
                `name — so every class ${local}() builds, in every file that imports it from ` +
                `here, reaches the element with no rule behind it. Re-export it under its ` +
                `own name.`
              : `${original}() is ${verb} as "${local}", and the scanner finds calls by name ` +
                `— so every class ${local}() builds in this file reaches the element with no ` +
                `rule behind it. Import it under its own name, or re-export a wrapper the ` +
                `scanner also knows.`,
        });
      }
    }
  }
}

/** Any import of the package itself: ESM, CommonJS, or a dynamic `import()`. */
const anyTailessImport =
  /(?:^|;)[ \t]*import\b[^;]*?["']tailess["']|\b(?:require|import)\(\s*["']tailess["']\s*\)/m;
/**
 * A name the whole package is bound to, whose members are helper calls:
 * `import * as tl from "tailess"`, `const tl = require("tailess")`, and
 * `const tl = await import("tailess")`. The last two were never read, so every check in a
 * CommonJS file that used one was off.
 */
const namespaceImports = [
  /(?:^|;)[ \t]*import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*["']tailess["']/gm,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:require|await\s+import)\(\s*["']tailess["']\s*\)/g,
];
/** `import { ss, on } from "tailess"`, the names a bare call has to be. */
const namedImport =
  /\bimport\s*(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*["']tailess["']/g;
/** `const { ss, on } = require("tailess")` or `= await import("tailess")`: the same. */
const namedRequire =
  /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:require|await\s+import)\(\s*["']tailess["']\s*\)/g;

/**
 * The local names an import or a destructuring `require` of tailess binds.
 *
 * Type-only entries bind nothing callable. A renamed one binds its new name, which is
 * not a helper name the scanner looks for — and the renamed-import check reports it.
 */
function boundNames(list: string, out: Set<string>): void {
  for (const raw of list.split(",")) {
    const entry = raw.trim();
    if (entry === "" || entry.startsWith("type ")) continue;
    const local = entry
      .split(/\s+as\s+|\s*:\s*/)
      .at(-1)
      ?.trim();
    if (local && /^[A-Za-z_$][\w$]*$/.test(local)) out.add(local);
  }
}

/** The bare names a file can call a helper by: what it imported from tailess by name. */
function importedNames(masked: string): Set<string> {
  const names = new Set<string>();
  for (const pattern of [namedImport, namedRequire]) {
    pattern.lastIndex = 0;
    for (let m = pattern.exec(masked); m !== null; m = pattern.exec(masked)) {
      boundNames(m[1] as string, names);
    }
  }
  return names;
}

/**
 * The names a call has to be reached through in this file to be one of ours, or `null`
 * when the file does not import tailess at all.
 *
 * Enumeration is deliberately loose — a helper name in a string or on any receiver yields
 * candidates, because an extra candidate costs a moment of compile time and a missing one
 * costs a broken layout. Reporting cannot borrow that looseness. `on`, `data`, `group`,
 * `has`, `inside`, `between` and `responsive` are ordinary identifiers in any codebase,
 * and `socket.on("presence", ({ open, dark }) => …)` in a file that has never heard of
 * this package was being told one of its classes is unstyled — failing the build under
 * `check --strict` or `diagnostics: "error"`.
 *
 * The trade is a false negative for a project that reaches the helpers through its own
 * re-export: it still gets full class enumeration and `tailess check` still proves the far
 * end, it just loses the source-level warnings. A warning that fires on working code is
 * worse, because it teaches people to stop reading them.
 */
function callableHere(masked: string): Set<string> | null {
  if (!anyTailessImport.test(masked)) return null;
  const receivers = new Set<string>([""]);
  for (const pattern of namespaceImports) {
    pattern.lastIndex = 0;
    for (let m = pattern.exec(masked); m !== null; m = pattern.exec(masked)) {
      receivers.add(m[1] as string);
    }
  }
  return receivers;
}

/** `configure({ …, merge: … })`, within reach of the call's opening brace. */
const configureMerge = /\bconfigure\s*\(\s*\{[\s\S]{0,2000}?\bmerge\s*:/;

/**
 * True when `source` hands tailess a merge of its own.
 *
 * The dead-class check runs the default `tailwind-merge`, because the build cannot run
 * the project's. With `configure({ merge: extendTailwindMerge(…) })` — the README's own
 * recipe for a custom `@utility` font size — the runtime keeps `text-hero text-white` and
 * the check called one of them dead, failing `check --strict` on working code. A project
 * that configures its merge gets no dead-class reports rather than wrong ones.
 */
export function configuresMerge(source: string): boolean {
  const code = source.startsWith("﻿") ? source.slice(1) : source;
  if (!code.includes("tailess")) return false;
  const masked = maskLiterals(code);
  return anyTailessImport.test(masked) && configureMerge.test(masked);
}

/**
 * True for a file a bundler wrote rather than a person: it carries a source-map comment,
 * or a minified line — long and dense with statements, where an inline SVG path is long
 * but has none.
 *
 * A bundle runs, but every class in it came from source that is scanned in its own right,
 * so reporting on it can only repeat or invent. It invented: Qwik's `server/` and vinxi's
 * `.vinxi/build` hold `import{ss as s}from"tailess"`, and each helper there was reported
 * as a renamed import — failing `check --strict` and `diagnostics: "error"` after a
 * successful build. Enumeration still reads such a file; only the checks skip it.
 */
function bundled(code: string): boolean {
  if (/^\/[/*][#@] sourceMappingURL=/m.test(code)) return true;
  for (let start = 0; start < code.length; ) {
    const end = code.indexOf("\n", start);
    const stop = end === -1 ? code.length : end;
    if (stop - start > 1000 && code.slice(start, stop).split(";").length > 20) return true;
    start = stop + 1;
  }
  return false;
}

/**
 * Every problem the scanner can prove from `code`.
 *
 * `file` is only ever read to decide whether an import statement in it is code, so a
 * caller with no path in hand loses nothing else by omitting it.
 */
export function diagnose(source: string, file?: string): Diagnostic[] {
  // A UTF-8 byte order mark survives `readFile(…, "utf8")`, and the import patterns are
  // anchored at the start of a line — so on a file saved with one, the first-line
  // import matched nothing and every check in the file went quiet, the renamed-import
  // one included.
  const code = source.startsWith("﻿") ? source.slice(1) : source;
  // Every check needs the file to import tailess, by that name — and most scanned files
  // never mention it. Masking each of them twice first doubled the cost of a cold scan.
  if (!code.includes("tailess") || bundled(code)) return [];
  const found: Diagnostic[] = [];
  const seen = new Set<string>();
  let suppressed = 0;
  const uncarriable: string[] = [];

  const report: Report = (d, value) => {
    if (value !== undefined) uncarriable.push(value);
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

  const masked = maskLiterals(code);
  if (file === undefined || !proseFile.test(file)) {
    renamedImports(masked, maskLiterals(code, true), report);
  }

  const receivers = callableHere(masked);
  if (receivers) {
    // A bare call is ours only under a name the file imported from tailess: Solid's `on`
    // beside tailess's `ss` is a file that imports the package, and its
    // `on(accessor, (c) => ({ open: c > 0 }))` was checked as a class map.
    const bare = importedNames(masked);
    // Nor a call that does not run: in a comment, or in a README's code fence.
    const inert = inertCode(code, file);
    for (const call of [...scanCalls(code), ...scanMatchCalls(code)]) {
      if (call.at !== undefined && inert[call.at] === 1) continue;
      if (call.receiver === "" ? bare.has(call.name) : receivers.has(call.receiver)) {
        check(call, report);
      }
    }
    for (const cls of uncarriedClasses(code)) {
      // `nth("3n{1}", …)` is already named, by the helper that took the value.
      if (uncarriable.some((value) => cls.includes(value))) continue;
      report({
        kind: "uncarried-class",
        message:
          `"${cls}" is built at runtime, but its "{", "}" or "\\" cannot be handed to ` +
          "Tailwind — @source inline(…) reads them as brace expansion or an escape — so it " +
          "has no rule. Write the class out as a literal somewhere in your source, where " +
          "Tailwind's own scan finds it (one with a backslash in String.raw`…`), or use a " +
          "value without the character.",
      });
    }
  }

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

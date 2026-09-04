import { escapeCondition } from "../internal/condition.js";
import {
  dictionaryKeys,
  extractStrings,
  isArrayLiteral,
  isObjectLiteral,
  objectLiterals,
  outerCalls,
  parseObject,
  type RawCall,
  scanCalls,
} from "./scan.js";

/**
 * Characters that can't appear in a candidate we hand to Tailwind via
 * `@source inline("…")`:
 *
 * - whitespace would split one candidate into two (and a newline makes Tailwind
 *   throw `Unterminated string`),
 * - `"` would close the string,
 * - `{` / `}` would trigger Tailwind's brace expansion,
 * - `\` and `;` would break out of the declaration.
 *
 * Anything containing them is dropped rather than risking a broken stylesheet;
 * such class names are vanishingly rare and always statically visible to Tailwind
 * anyway when written as a literal.
 */
const unsafe = /[\s"{}\\;]/;

/**
 * How deep nested buckets are followed. Real compound variants are two or three
 * deep; the bound is here because this walks whatever bytes happen to be in a file.
 *
 * It matches `ss`' own limit exactly, and has to: a level the runtime still emits
 * but the scanner stops at is a class with no CSS behind it — the silent failure
 * this whole module exists to rule out.
 */
const maxNesting = 10;

/**
 * How many times following a helper call found *inside* a bucket may itself lead
 * to following another one.
 *
 * Separate from {@link maxNesting}, and far smaller, because it bounds a different
 * cost. Map nesting descends into text already carved out; following a call
 * re-scans the whole value, and the top-level sweep hands *every* call in the file
 * to {@link enumerate} — so without a bound a chain of nested calls is re-walked
 * once per ancestor, which is quadratic in how deep the chain runs.
 *
 * Two hops covers what people write. One is the ordinary case —
 * `until("md", on("hover", …))`, `ss({ md: withPrefix(…) })` — and the second is
 * there because these compose: `on("hover", until("md", withPrefix(…)))` is three
 * prefixes deep and each one has to reach the innermost classes. Beyond that the
 * spelling is unreadable long before it is unsupported. A nested `ss` or
 * `responsive` needs no hop at all: its map is an object literal, so
 * {@link objectLiterals} already finds it right there in the value.
 */
const maxFollow = 2;

/**
 * A JavaScript numeric literal, minus any sign: decimal with an optional leading or
 * trailing dot, an exponent, digit separators, and the three radix prefixes.
 *
 * Enumerating the spellings rather than matching digits is the point. A value the
 * scanner cannot read falls back to the attribute-presence form, which is right for
 * something genuinely dynamic and wrong for `0x10` — the runtime resolves that to
 * `16` and builds `data-[n=16]:`, so a narrower pattern quietly loses the class.
 */
const numericBody =
  /^(?:0[xX][0-9a-fA-F][0-9a-fA-F_]*|0[oO][0-7][0-7_]*|0[bB][01][01_]*|(?:\d[\d_]*)?\.?(?:\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)$/;

/**
 * The text a static {@link data} value interpolates to at runtime, or `null` when it
 * is not a literal that can be resolved without running the code.
 *
 * Template interpolation stringifies the *number*, not the source text, so the answer
 * has to go through `Number` — `1e3` is `"1000"` on the element, never `"1e3"`.
 */
function staticValue(literal: string): string | null {
  if (literal === "true" || literal === "false") return literal;
  const negative = literal.startsWith("-");
  const body = negative || literal.startsWith("+") ? literal.slice(1) : literal;
  if (!numericBody.test(body)) return null;
  const digits = body.replace(/_/g, "");
  // Every part of the decimal form is optional, so `.` and `+` reach here as well.
  if (!/\d/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return String(negative ? -value : value);
}

/** Helper name to the variant it builds, for the four `nth-*` families. */
const nthVariants: Record<string, string> = {
  nth: "nth",
  nthLast: "nth-last",
  nthOfType: "nth-of-type",
  nthLastOfType: "nth-last-of-type",
};

/** Records the classes one bucket produces. `prefix` is `""` for unprefixed ones. */
type Add = (prefix: string, tokens: string[]) => void;

/**
 * True if every bracket and quote in `candidate` closes.
 *
 * `@source inline("…")` is CSS, parsed by matching parentheses and by tracking string
 * delimiters, so one malformed candidate swallows the rest of the directive — and with
 * it every later class in the same chunk, *including ones from files that have nothing
 * to do with it*. Measured: one bad candidate at the head of a chunk cost all 60 that
 * followed it.
 *
 * Both shapes are reachable because the sweep reads every string literal at a call
 * site, not only the ones that are classes. An ordinary `calc(100% - 2rem)` in a helper
 * argument splits on whitespace into the token `calc(100%`; an apostrophe anywhere in
 * any string a matched call touches — `console.group("user's session")` will do it —
 * opens a CSS string that runs to the end of the payload.
 *
 * The test is *balance*, not absence, because `content-['x']` is a real utility and
 * banning the character outright would drop it. A real utility always closes what it
 * opens, so requiring that costs nothing and confines the damage to the junk token.
 */
function isBalanced(candidate: string): boolean {
  let round = 0;
  let square = 0;
  let quotes = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    const ch = candidate.charCodeAt(i);
    if (ch === 40) {
      round += 1;
    } else if (ch === 41) {
      round -= 1;
      if (round < 0) return false;
    } else if (ch === 91) {
      square += 1;
    } else if (ch === 93) {
      square -= 1;
      if (square < 0) return false;
    } else if (ch === 39) {
      quotes += 1;
    }
  }
  return round === 0 && square === 0 && quotes % 2 === 0;
}

/** Guards against feeding junk (or a whole expression) to Tailwind as a candidate. */
function isSafeCandidate(candidate: string): boolean {
  return (
    candidate.length > 0 &&
    candidate.length <= 255 &&
    !unsafe.test(candidate) &&
    isBalanced(candidate)
  );
}

/**
 * Class tokens in one argument: every string literal split on whitespace, plus the
 * keys of any `clsx` dictionary, which names its classes in the *keys* rather than
 * in a literal. `bare` says whether an object standing on its own here is one —
 * see {@link dictionaryKeys}.
 */
function tokensFrom(argText: string | undefined, bare: boolean): string[] {
  if (!argText) return [];
  const tokens: string[] = [];
  for (const literal of extractStrings(argText)) {
    for (const token of literal.split(/\s+/)) {
      if (token) tokens.push(token);
    }
  }
  // `{ hidden: !open }` is the idiomatic spelling and puts no string literal in the
  // source at all; quoting the key was the only reason the documented
  // `[{ "text-lg": on }]` form ever worked.
  for (const key of dictionaryKeys(argText, bare)) tokens.push(key);
  return tokens;
}

/** Tokens of an argument that is a class value, where a lone object is a dictionary. */
function classTokens(argText: string | undefined): string[] {
  return tokensFrom(argText, true);
}

/** Tokens of an `ss` bucket value, where a lone object is a nested map instead. */
function bucketTokens(argText: string | undefined): string[] {
  return tokensFrom(argText, false);
}

/**
 * Enumerate every Tailwind class a tailess call site *could* produce, so they can
 * be handed to Tailwind's scanner — which only ever sees literal class strings and
 * therefore misses the prefixes tailess builds at runtime.
 *
 * The result deliberately over-approximates: both branches of a ternary and every
 * entry of a conditional object are emitted, since either may appear at runtime.
 * A few extra unused candidates cost nothing; a missing one costs you the style.
 *
 * Values that aren't statically knowable — a variable, an interpolated template,
 * a spread — cannot be recovered and are skipped.
 *
 * @param code Source text of a file (ts/tsx/js/jsx/vue/svelte/…).
 * @returns Sorted, de-duplicated, `@source inline`-safe class names.
 */
export function extractClasses(code: string): string[] {
  const found = new Set<string>();

  const add: Add = (prefix, tokens) => {
    if (prefix === "") return;
    for (const token of tokens) {
      const candidate = `${prefix}:${token}`;
      if (isSafeCandidate(candidate)) found.add(candidate);
    }
  };

  for (const call of scanCalls(code)) enumerate(call, add);

  return [...found].sort();
}

/** Walk one `ss` bucket map; every class it produces carries `prefix`. */
function enumerateMap(text: string, prefix: string, depth: number, add: Add, follow: number): void {
  for (const { key, value } of parseObject(text)) {
    // `base` contributes no segment of its own, exactly as at runtime.
    const scope = key === "base" ? prefix : prefix === "" ? key : `${prefix}:${key}`;
    enumerateValue(value, scope, depth, add, follow);
  }
}

/**
 * Stack `prefix` onto every class produced by a tailess helper called inside another
 * one's class argument.
 *
 * A helper's result is already a prefixed string by the time its caller sees it, so
 * the caller's own prefix goes in front: `until("md", on("hover", "p-2"))` is
 * `max-md:hover:p-2`, and `ss({ md: withPrefix("has-[:x]", "u") })` is
 * `md:has-[:x]:u`. The top-level sweep finds the inner call too, but only ever
 * unprefixed — this is the sole source of the stacked form.
 *
 * `calls` is passed in rather than scanned here so a caller with several prefixes
 * for one argument (a `data` value written as a ternary, say) reads the text once.
 */
function followCalls(
  calls: RawCall[],
  prefix: string,
  depth: number,
  add: Add,
  follow: number,
): void {
  for (const call of calls) {
    enumerate(
      call,
      (inner, tokens) => add(inner === "" ? prefix : `${prefix}:${inner}`, tokens),
      depth,
      follow - 1,
    );
  }
}

/**
 * Emit one helper argument that is a class value, under each of `prefixes`.
 *
 * Every helper but `ss` and `responsive` funnels through here, so the rule that a
 * nested call stacks is applied in one place rather than restated per case.
 */
function emitValue(text: string, prefixes: string[], add: Add, follow: number): void {
  if (prefixes.length === 0) return;
  const tokens = classTokens(text);
  const calls = follow > 0 ? outerCalls(text) : [];
  for (const prefix of prefixes) {
    if (prefix === "") continue;
    if (calls.length > 0) followCalls(calls, prefix, 0, add, follow);
    add(prefix, tokens);
  }
}

/** Walk one bucket's value, which is either classes, a nested map, or both. */
function enumerateValue(
  text: string,
  scope: string,
  depth: number,
  add: Add,
  follow: number,
): void {
  const nested = depth < maxNesting ? objectLiterals(text) : [];

  for (const inner of nested) enumerateMap(inner, scope, depth + 1, add, follow);

  // A `base` bucket is skipped because its scope is empty, which is exactly what the
  // top-level sweep already emitted.
  if (scope !== "" && follow > 0) followCalls(outerCalls(text), scope, depth, add, follow);

  // A value that is *only* a map carries no classes of its own, so stopping here
  // keeps us from emitting `md:p-8` alongside the `md:hover:p-8` that was meant —
  // a candidate that resolves, and would ship a rule nothing uses. Anything else
  // (`cond && {…}`, a ternary, an array holding a clsx dictionary) may still carry
  // classes at this level, and missing one of those is the failure that matters.
  if (nested.length === 0 || !isObjectLiteral(text)) add(scope, bucketTokens(text));
}

/**
 * Enumerate every `ss` map inside one value.
 *
 * A plain string needs nothing: it is unprefixed, so Tailwind reads it out of the
 * source itself and `add` drops it anyway. Only a map carries a prefix that has to
 * be predicted here.
 */
function emitMaps(text: string, depth: number, add: Add, follow: number): void {
  for (const map of objectLiterals(text)) enumerateMap(map, "", depth, add, follow);
}

function enumerate(call: RawCall, add: Add, depth = 0, follow = maxFollow): void {
  const { name, args } = call;

  switch (name) {
    // ss({ base: "...", md: "..." }, cond && { hover: "..." }, className)
    // — the key *is* the prefix, and a nested map stacks onto it. Text outside a
    // map is unprefixed, so Tailwind already sees it and `add` ignores it anyway.
    case "ss": {
      for (const arg of args) {
        for (const literal of objectLiterals(arg)) enumerateMap(literal, "", depth, add, follow);
      }
      return;
    }

    // responsive(base, { md: "..." }) — args[0] is unprefixed, so already literal.
    // Values here are plain class values; `responsive` has no nesting.
    case "responsive": {
      for (const literal of objectLiterals(args[1] ?? "")) {
        for (const { key, value } of parseObject(literal)) emitValue(value, [key], add, follow);
      }
      return;
    }

    // on("hover", "...") or on(["dark", "hover"], "...") — an array stacks.
    case "on": {
      if (args.length < 2) return;
      const stateArg = args[0] ?? "";
      const states = extractStrings(stateArg);
      const prefixes = isArrayLiteral(stateArg) ? [states.join(":")] : states;
      emitValue(args[1] ?? "", prefixes, add, follow);
      return;
    }

    case "until": {
      if (args.length < 2) return;
      const keys = extractStrings(args[0] ?? "");
      emitValue(
        args[1] ?? "",
        keys.map((key) => `max-${key}`),
        add,
        follow,
      );
      return;
    }

    case "between": {
      if (args.length < 3) return;
      const prefixes: string[] = [];
      for (const min of extractStrings(args[0] ?? "")) {
        for (const max of extractStrings(args[1] ?? "")) prefixes.push(`${min}:max-${max}`);
      }
      emitValue(args[2] ?? "", prefixes, add, follow);
      return;
    }

    case "data": {
      if (args.length < 3) return;
      const valueArg = args[1] ?? "";
      const values = extractStrings(valueArg);
      const literal = valueArg.trim();
      // `data` takes `string | number | boolean | null | undefined`. A number or a
      // boolean is every bit as static as a string — it just isn't a string
      // *literal*, so the sweep above finds nothing and the presence form would be
      // emitted for a call the runtime builds the value form for. That is wrong
      // twice: `data-[checked=true]:` never gets CSS, and the `data-[checked]:` that
      // does is a selector matching whenever the attribute is merely present.
      // `data-checked={true}` is what React writes, so this is a mainstream path.
      if (values.length === 0) {
        const resolved = staticValue(literal);
        if (resolved !== null) values.push(resolved);
      }
      // `null`/`undefined` (or a non-literal value) means the presence form.
      const presence = values.length === 0 || literal === "null" || literal === "undefined";
      const prefixes: string[] = [];
      for (const name of extractStrings(args[0] ?? "")) {
        if (presence) prefixes.push(`data-[${name}]`);
        for (const value of values) prefixes.push(`data-[${name}=${value}]`);
      }
      emitValue(args[2] ?? "", prefixes, add, follow);
      return;
    }

    case "aria": {
      if (args.length < 2) return;
      const names = extractStrings(args[0] ?? "");
      emitValue(
        args[1] ?? "",
        names.map((name) => `aria-${name}`),
        add,
        follow,
      );
      return;
    }

    case "withPrefix": {
      if (args.length < 2) return;
      emitValue(args[1] ?? "", extractStrings(args[0] ?? ""), add, follow);
      return;
    }

    // supports("display: grid", "...") / notSupports(…) — the condition is escaped
    // through the very function the runtime uses, because a candidate that spells
    // the spaces differently is worse than no candidate at all: the class still
    // reaches the element, and `isSafeCandidate` drops the unescaped form outright.
    // group("row", "hover", "…") / peer("email", "invalid", "…") — the name is a
    // modifier on the variant, so the prefix is `group-<state>/<name>`.
    case "group":
    case "peer": {
      if (args.length < 3) return;
      const prefixes: string[] = [];
      for (const label of extractStrings(args[0] ?? "")) {
        for (const state of extractStrings(args[1] ?? "")) {
          prefixes.push(`${name}-${state}/${label}`);
        }
      }
      emitValue(args[2] ?? "", prefixes, add, follow);
      return;
    }

    // container("sidebar", "@md", "…") — the key already carries its own `@`.
    case "container": {
      if (args.length < 3) return;
      const prefixes: string[] = [];
      for (const label of extractStrings(args[0] ?? "")) {
        for (const key of extractStrings(args[1] ?? "")) prefixes.push(`${key}/${label}`);
      }
      emitValue(args[2] ?? "", prefixes, add, follow);
      return;
    }

    // has(":checked", "…") / notHas(…) / inside(".dark", "…") — an arbitrary selector,
    // escaped through the same function the runtime uses. The plain state spellings
    // (`has-checked`, `in-focus`) are keys and need no case here.
    case "has":
    case "notHas":
    case "inside": {
      if (args.length < 2) return;
      const variant = name === "has" ? "has" : name === "notHas" ? "not-has" : "in";
      const selectors = extractStrings(args[0] ?? "");
      emitValue(
        args[1] ?? "",
        selectors.map((selector) => `${variant}-[${escapeCondition(selector)}]`),
        add,
        follow,
      );
      return;
    }

    // variants({ base, variants: { name: { option: … } }, compound: [{ …, class }] })
    //
    // The one call site here whose object keys are *not* prefixes. `tone` and `size`
    // name variants, `primary` and `lg` name options, and neither reaches a class —
    // only the leaves do. Reading the config as an `ss` map would enumerate
    // `tone:size:primary:bg-blue-600` and, worse, miss the map inside an option that
    // does need enumerating. So each of the three places a class can hide is walked
    // to explicitly, and everything else in the config is left alone.
    case "variants": {
      const [config] = objectLiterals(args[0] ?? "");
      if (config === undefined) return;
      for (const { key, value } of parseObject(config)) {
        if (key === "base") {
          emitMaps(value, depth, add, follow);
        } else if (key === "variants") {
          for (const group of objectLiterals(value)) {
            for (const option of parseObject(group)) {
              for (const choices of objectLiterals(option.value)) {
                for (const leaf of parseObject(choices)) emitMaps(leaf.value, depth, add, follow);
              }
            }
          }
        } else if (key === "compound") {
          // A real array of rule objects, which is not what an array means anywhere
          // else here: inside an `ss` value an object is a `clsx` dictionary, so
          // `objectLiterals` deliberately skips brace groups within brackets. Unwrap
          // the one level so the rules themselves are visible to it.
          const list = value.trim();
          const rules = list.startsWith("[") && list.endsWith("]") ? list.slice(1, -1) : list;
          for (const rule of objectLiterals(rules)) {
            for (const field of parseObject(rule)) {
              if (field.key === "class") emitMaps(field.value, depth, add, follow);
            }
          }
        }
      }
      return;
    }

    // nth(3, "…") / nth("3n+1", "…") and the three siblings. A number is a position
    // and goes in bare; a string is an expression and goes in brackets — the same
    // split the runtime makes, so the two agree on which spelling was built.
    case "nth":
    case "nthLast":
    case "nthOfType":
    case "nthLastOfType": {
      if (args.length < 2) return;
      const variant = nthVariants[name];
      const arg = args[0] ?? "";
      const prefixes = extractStrings(arg).map(
        (value) => `${variant}-[${escapeCondition(value)}]`,
      );
      if (prefixes.length === 0) {
        const resolved = staticValue(arg.trim());
        if (resolved !== null) prefixes.push(`${variant}-${resolved}`);
      }
      emitValue(args[1] ?? "", prefixes, add, follow);
      return;
    }

    case "supports":
    case "notSupports": {
      if (args.length < 2) return;
      const kind = name === "supports" ? "supports" : "not-supports";
      const conditions = extractStrings(args[0] ?? "");
      emitValue(
        args[1] ?? "",
        conditions.map((condition) => `${kind}-[${escapeCondition(condition)}]`),
        add,
        follow,
      );
      return;
    }
  }
}

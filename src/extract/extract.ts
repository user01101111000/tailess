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
 * One hop is enough. What needs following is a helper whose output is a prefixed
 * string — `withPrefix`, `on`, `until`, `between`, `data`, `aria` — and none of
 * those contains a further bucket to descend into. A nested `ss` or `responsive`
 * needs no hop at all: its map is an object literal, so {@link objectLiterals}
 * already finds it right there in the value.
 */
const maxFollow = 1;

/**
 * A numeric or boolean literal — the {@link data} values that are static without
 * being string literals.
 */
const numberOrBoolean = /^(?:true|false|-?\d+(?:\.\d+)?)$/;

/** Records the classes one bucket produces. `prefix` is `""` for unprefixed ones. */
type Add = (prefix: string, tokens: string[]) => void;

/** Guards against feeding junk (or a whole expression) to Tailwind as a candidate. */
function isSafeCandidate(candidate: string): boolean {
  return candidate.length > 0 && candidate.length <= 255 && !unsafe.test(candidate);
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

  // A tailess helper called *inside* a bucket has already built its own prefix by
  // the time the bucket sees the string it returned, so the bucket's key stacks on
  // top of that prefix — `ss({ md: withPrefix("has-[:checked]", "underline") })` is
  // `md:has-[:checked]:underline`. Nothing else can spell that: `has-*` takes a
  // value, so it is not one of the keys. A `base` bucket is skipped because its
  // scope is empty, which is exactly what the top-level sweep already emitted.
  if (scope !== "" && follow > 0) {
    for (const call of outerCalls(text)) {
      enumerate(
        call,
        (prefix, tokens) => add(prefix === "" ? scope : `${scope}:${prefix}`, tokens),
        depth,
        follow - 1,
      );
    }
  }

  // A value that is *only* a map carries no classes of its own, so stopping here
  // keeps us from emitting `md:p-8` alongside the `md:hover:p-8` that was meant —
  // a candidate that resolves, and would ship a rule nothing uses. Anything else
  // (`cond && {…}`, a ternary, an array holding a clsx dictionary) may still carry
  // classes at this level, and missing one of those is the failure that matters.
  if (nested.length === 0 || !isObjectLiteral(text)) add(scope, bucketTokens(text));
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
        for (const { key, value } of parseObject(literal)) add(key, classTokens(value));
      }
      return;
    }

    // on("hover", "...") or on(["dark", "hover"], "...") — an array stacks.
    case "on": {
      if (args.length < 2) return;
      const stateArg = args[0] ?? "";
      const classes = classTokens(args[1]);
      const states = extractStrings(stateArg);
      if (isArrayLiteral(stateArg)) {
        add(states.join(":"), classes);
      } else {
        for (const state of states) add(state, classes);
      }
      return;
    }

    case "until": {
      if (args.length < 2) return;
      const classes = classTokens(args[1]);
      for (const key of extractStrings(args[0] ?? "")) add(`max-${key}`, classes);
      return;
    }

    case "between": {
      if (args.length < 3) return;
      const classes = classTokens(args[2]);
      for (const min of extractStrings(args[0] ?? "")) {
        for (const max of extractStrings(args[1] ?? "")) add(`${min}:max-${max}`, classes);
      }
      return;
    }

    case "data": {
      if (args.length < 3) return;
      const valueArg = args[1] ?? "";
      const classes = classTokens(args[2]);
      const values = extractStrings(valueArg);
      const literal = valueArg.trim();
      // `data` takes `string | number | boolean | null | undefined`, and a number or
      // a boolean is every bit as static as a string — it just isn't a string
      // *literal*, so the sweep above finds nothing and the presence form would be
      // emitted for a call the runtime builds the value form for. That is wrong
      // twice: `data-[checked=true]:` never gets CSS, and the `data-[checked]:` that
      // does is a selector matching whenever the attribute is merely present.
      // `data-checked={true}` is what React writes, so this is a mainstream path.
      if (values.length === 0 && numberOrBoolean.test(literal)) values.push(literal);
      // `null`/`undefined` (or a non-literal value) means the presence form.
      const presence = values.length === 0 || literal === "null" || literal === "undefined";
      for (const name of extractStrings(args[0] ?? "")) {
        if (presence) add(`data-[${name}]`, classes);
        for (const value of values) add(`data-[${name}=${value}]`, classes);
      }
      return;
    }

    case "aria": {
      if (args.length < 2) return;
      const classes = classTokens(args[1]);
      for (const name of extractStrings(args[0] ?? "")) add(`aria-${name}`, classes);
      return;
    }

    case "withPrefix": {
      if (args.length < 2) return;
      const classes = classTokens(args[1]);
      for (const prefix of extractStrings(args[0] ?? "")) add(prefix, classes);
      return;
    }
  }
}

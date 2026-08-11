import { extractStrings, isArrayLiteral, parseObject, type RawCall, scanCalls } from "./scan.js";

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

/** Guards against feeding junk (or a whole expression) to Tailwind as a candidate. */
function isSafeCandidate(candidate: string): boolean {
  return candidate.length > 0 && candidate.length <= 255 && !unsafe.test(candidate);
}

/** Split every extracted string literal on whitespace into individual class tokens. */
function tokensFrom(argText: string | undefined): string[] {
  if (!argText) return [];
  const tokens: string[] = [];
  for (const literal of extractStrings(argText)) {
    for (const token of literal.split(/\s+/)) {
      if (token) tokens.push(token);
    }
  }
  return tokens;
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

  const add = (prefix: string, tokens: string[]): void => {
    if (prefix === "") return;
    for (const token of tokens) {
      const candidate = `${prefix}:${token}`;
      if (isSafeCandidate(candidate)) found.add(candidate);
    }
  };

  for (const call of scanCalls(code)) enumerate(call, add);

  return [...found].sort();
}

function enumerate(call: RawCall, add: (prefix: string, tokens: string[]) => void): void {
  const { name, args } = call;

  switch (name) {
    // ss({ base: "...", md: "...", hover: "..." }) — the key *is* the prefix.
    case "ss": {
      for (const { key, value } of parseObject(args[0] ?? "")) {
        if (key === "base") continue;
        add(key, tokensFrom(value));
      }
      return;
    }

    // responsive(base, { md: "..." }) — args[0] is unprefixed, so already literal.
    case "responsive": {
      for (const { key, value } of parseObject(args[1] ?? "")) {
        add(key, tokensFrom(value));
      }
      return;
    }

    // on("hover", "...") or on(["dark", "hover"], "...") — an array stacks.
    case "on": {
      if (args.length < 2) return;
      const stateArg = args[0] ?? "";
      const classes = tokensFrom(args[1]);
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
      const classes = tokensFrom(args[1]);
      for (const key of extractStrings(args[0] ?? "")) add(`max-${key}`, classes);
      return;
    }

    case "between": {
      if (args.length < 3) return;
      const classes = tokensFrom(args[2]);
      for (const min of extractStrings(args[0] ?? "")) {
        for (const max of extractStrings(args[1] ?? "")) add(`${min}:max-${max}`, classes);
      }
      return;
    }

    case "data": {
      if (args.length < 3) return;
      const valueArg = args[1] ?? "";
      const classes = tokensFrom(args[2]);
      const values = extractStrings(valueArg);
      const literal = valueArg.trim();
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
      const classes = tokensFrom(args[1]);
      for (const name of extractStrings(args[0] ?? "")) add(`aria-${name}`, classes);
      return;
    }

    case "withPrefix": {
      if (args.length < 2) return;
      const classes = tokensFrom(args[1]);
      for (const prefix of extractStrings(args[0] ?? "")) add(prefix, classes);
      return;
    }
  }
}

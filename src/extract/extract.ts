import { defaultStates } from "../config/defaults.js";
import { extractStrings, isArrayLiteral, parseObject, type RawCall, scanCalls } from "./scan.js";

/**
 * Config needed to resolve variant prefixes exactly as the runtime does. Only
 * `states` affects the output — screen keys are used verbatim as prefixes — but
 * both are accepted so a resolved tailess config can be passed straight through.
 */
export interface ExtractOptions {
  screens?: Record<string, string>;
  states?: Record<string, string>;
}

/** Split every extracted string on whitespace into individual class tokens. */
function tokensFrom(argText: string | undefined): string[] {
  if (!argText) return [];
  const tokens: string[] = [];
  for (const str of extractStrings(argText)) {
    for (const token of str.split(/\s+/)) {
      if (token) tokens.push(token);
    }
  }
  return tokens;
}

/**
 * Enumerate every Tailwind class a tailess call site *could* produce, so they can
 * be handed to Tailwind's scanner (which only sees literal class strings).
 *
 * The result deliberately over-approximates: both branches of a ternary and every
 * entry of a conditional object are emitted, since any of them may appear at
 * runtime. Values that are not statically knowable — variables, interpolated
 * templates, spreads — cannot be recovered and are skipped.
 *
 * @param code   Source text of a file (any of ts/tsx/js/jsx/…).
 * @param options Resolved `states` (for alias keys like `groupHover → group-hover`).
 * @returns Sorted, de-duplicated class names.
 */
export function extractClasses(code: string, options: ExtractOptions = {}): string[] {
  const states = { ...defaultStates, ...options.states } as Record<string, string>;
  const resolveState = (key: string): string => states[key] ?? key;

  const out = new Set<string>();
  const add = (prefix: string, tokens: string[]): void => {
    for (const token of tokens) out.add(`${prefix}:${token}`);
  };

  for (const call of scanCalls(code)) {
    enumerate(call, resolveState, add);
  }

  return [...out].sort();
}

function enumerate(
  call: RawCall,
  resolveState: (key: string) => string,
  add: (prefix: string, tokens: string[]) => void,
): void {
  const { name, args } = call;

  switch (name) {
    case "ss": {
      for (const { key, value } of parseObject(args[0] ?? "")) {
        if (key === "base") continue;
        add(resolveState(key), tokensFrom(value));
      }
      return;
    }

    case "responsive": {
      // args[0] is the unprefixed base (already literal); args[1] holds the variants.
      for (const { key, value } of parseObject(args[1] ?? "")) {
        add(key, tokensFrom(value));
      }
      return;
    }

    case "on": {
      if (args.length < 2) return;
      const stateArg = args[0] ?? "";
      const classes = tokensFrom(args[1]);
      const stateStrings = extractStrings(stateArg);
      if (isArrayLiteral(stateArg)) {
        const prefix = stateStrings.map(resolveState).join(":");
        if (prefix) add(prefix, classes);
      } else {
        for (const state of stateStrings) add(resolveState(state), classes);
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
      const valueText = valueArg.trim();
      const presence = values.length === 0 || valueText === "null" || valueText === "undefined";
      for (const nameArg of extractStrings(args[0] ?? "")) {
        if (presence) add(`data-[${nameArg}]`, classes);
        for (const value of values) add(`data-[${nameArg}=${value}]`, classes);
      }
      return;
    }

    case "aria": {
      if (args.length < 2) return;
      const classes = tokensFrom(args[1]);
      for (const nameArg of extractStrings(args[0] ?? "")) add(`aria-${nameArg}`, classes);
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

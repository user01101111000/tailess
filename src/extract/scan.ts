/**
 * A tailess helper call discovered in source code, reduced to its name and the
 * raw text of each top-level argument. This is a *syntactic* view — no values
 * are evaluated. {@link extractClasses} turns it into concrete class candidates.
 */
export interface RawCall {
  /** The called helper's name (e.g. `ss`, `on`), even for method calls like `st.ss`. */
  name: string;
  /** Raw source text of each top-level argument, trimmed. */
  args: string[];
}

/** Helper names whose output contains variant prefixes built at runtime. */
const KNOWN_CALLS = new Set([
  "ss",
  "responsive",
  "on",
  "until",
  "between",
  "data",
  "aria",
  "withPrefix",
]);

const isIdentStart = (c: string | undefined): boolean =>
  c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$");

const isIdentPart = (c: string | undefined): boolean =>
  isIdentStart(c) || (c !== undefined && c >= "0" && c <= "9");

/** Skip a `'...'` or `"..."` string starting at `i`; returns the index past the closing quote. */
function skipString(code: string, i: number, quote: string): number {
  i += 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    i += 1;
  }
  return i;
}

/** Skip a `` `...` `` template starting at `i`, including balanced `${ ... }`; returns index past the backtick. */
function skipTemplate(code: string, i: number): number {
  i += 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") return i + 1;
    if (c === "$" && code[i + 1] === "{") {
      i += 2;
      let depth = 1;
      while (i < code.length && depth > 0) {
        const d = code[i];
        if (d === "'" || d === '"') {
          i = skipString(code, i, d);
          continue;
        }
        if (d === "`") {
          i = skipTemplate(code, i);
          continue;
        }
        if (d === "{") depth += 1;
        else if (d === "}") depth -= 1;
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return i;
}

/** Skip `//` and block comments; returns the index past the comment, or `i` if none. */
function skipComment(code: string, i: number): number {
  if (code[i] === "/" && code[i + 1] === "/") {
    i += 2;
    while (i < code.length && code[i] !== "\n") i += 1;
    return i;
  }
  if (code[i] === "/" && code[i + 1] === "*") {
    i += 2;
    while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i += 1;
    return Math.min(i + 2, code.length);
  }
  return i;
}

/** Skip whitespace and comments starting at `i`. */
function skipTrivia(code: string, i: number): number {
  while (i < code.length) {
    const c = code[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    const j = skipComment(code, i);
    if (j !== i) {
      i = j;
      continue;
    }
    break;
  }
  return i;
}

/** Read a parenthesized argument list; `open` points at the `(`. Returns the inner text and the end index. */
function readParen(code: string, open: number): { argsText: string; end: number } {
  let i = open + 1;
  const start = i;
  let depth = 1;
  while (i < code.length && depth > 0) {
    const c = code[i];
    if (c === "'" || c === '"') {
      i = skipString(code, i, c);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(code, i);
      continue;
    }
    const j = skipComment(code, i);
    if (j !== i) {
      i = j;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    i += 1;
  }
  return { argsText: code.slice(start, Math.max(start, i - 1)), end: i };
}

/**
 * Split a comma-separated argument list at the top level, ignoring commas inside
 * strings, templates, comments, and nested `()`/`[]`/`{}`.
 */
export function splitArgs(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  let sawContent = false;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      i = skipString(text, i, c);
      sawContent = true;
      continue;
    }
    if (c === "`") {
      i = skipTemplate(text, i);
      sawContent = true;
      continue;
    }
    const j = skipComment(text, i);
    if (j !== i) {
      i = j;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (c === "," && depth === 0) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
      i += 1;
      continue;
    }
    if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") sawContent = true;
    i += 1;
  }
  const last = text.slice(start).trim();
  if (last !== "" || (sawContent && args.length > 0)) args.push(last);
  return args;
}

/**
 * Collect the contents of every string literal in `text`: `'...'`, `"..."`, and
 * interpolation-free `` `...` `` templates. Templates containing `${` are dynamic
 * and skipped.
 */
export function extractStrings(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const end = skipString(text, i, c);
      out.push(unescapeString(text.slice(i + 1, end - 1)));
      i = end;
      continue;
    }
    if (c === "`") {
      const end = skipTemplate(text, i);
      const inner = text.slice(i + 1, end - 1);
      if (!inner.includes("${")) out.push(inner);
      i = end;
      continue;
    }
    const j = skipComment(text, i);
    if (j !== i) {
      i = j;
      continue;
    }
    i += 1;
  }
  return out;
}

/** Minimal unescaping of the common escapes that appear inside class strings. */
function unescapeString(s: string): string {
  return s.replace(/\\(.)/g, "$1");
}

/**
 * Parse the top-level `key: value` properties of an object-literal argument.
 * Spread (`...x`), shorthand (`{ md }`), and computed (`[k]:`) keys are skipped —
 * they carry no statically-known class strings for their key.
 */
export function parseObject(text: string): Array<{ key: string; value: string }> {
  const t = text.trim();
  if (!t.startsWith("{")) return [];
  const close = t.lastIndexOf("}");
  if (close <= 0) return [];
  const props: Array<{ key: string; value: string }> = [];
  for (const entry of splitArgs(t.slice(1, close))) {
    if (entry === "" || entry.startsWith("...")) continue;
    const colon = topLevelColon(entry);
    if (colon === -1) continue;
    const key = normalizeKey(entry.slice(0, colon).trim());
    if (key == null) continue;
    props.push({ key, value: entry.slice(colon + 1).trim() });
  }
  return props;
}

/** Index of the first `:` at bracket depth 0 (outside strings), or -1. */
function topLevelColon(entry: string): number {
  let depth = 0;
  let i = 0;
  while (i < entry.length) {
    const c = entry[i];
    if (c === "'" || c === '"') {
      i = skipString(entry, i, c);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(entry, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (c === ":" && depth === 0) return i;
    i += 1;
  }
  return -1;
}

/** Unquote a property key; returns null for computed keys, which we can't resolve statically. */
function normalizeKey(raw: string): string | null {
  if (raw.startsWith("[")) return null;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith("`") && raw.endsWith("`"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

/** True if `text` (trimmed) is an array literal. */
export function isArrayLiteral(text: string): boolean {
  return text.trim().startsWith("[");
}

/**
 * Scan source code for tailess helper calls (bare or as a method, e.g. `st.ss`)
 * and return each with its raw top-level arguments. Calls inside strings and
 * comments are ignored; calls inside template interpolations are not scanned.
 */
export function scanCalls(code: string): RawCall[] {
  const calls: RawCall[] = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === undefined) break;
    if (c === "'" || c === '"') {
      i = skipString(code, i, c);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(code, i);
      continue;
    }
    const j = skipComment(code, i);
    if (j !== i) {
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let end = i + 1;
      while (end < code.length && isIdentPart(code[end])) end += 1;
      const name = code.slice(i, end);
      const paren = skipTrivia(code, end);
      if (code[paren] === "(" && KNOWN_CALLS.has(name)) {
        const { argsText } = readParen(code, paren);
        calls.push({ name, args: splitArgs(argsText) });
      }
      i = end;
      continue;
    }
    i += 1;
  }
  return calls;
}

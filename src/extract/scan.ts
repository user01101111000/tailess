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

/**
 * Helper names whose output contains variant prefixes built at runtime, matched
 * bare or as a method (`st.ss(...)`).
 *
 * A lookbehind rather than `\b` so `$ss(` and `_on(` — legal, distinct
 * identifiers — don't match, while `st.ss(` still does.
 */
const callPattern = /(?<![\w$])(ss|responsive|on|until|between|data|aria|withPrefix)\s*\(/g;

/**
 * A second instance of {@link callPattern} for {@link outerCalls}.
 *
 * A `lastIndex` is state, and the two scans interleave: following a bucket value
 * re-enters the search while an outer one is still walking. Sharing one regex
 * would let the inner scan rewind the outer one.
 */
const outerCallPattern = new RegExp(callPattern.source, "g");

/**
 * How far an argument list may run before we stop reading it.
 *
 * Only reached when the `(` didn't really open a call — prose like "turn it
 * on (or off)" matches the pattern too. The cap keeps such a match from
 * dragging the rest of the file in as one giant argument.
 */
const maxArgsLength = 20_000;

/** How deep a template may nest inside its own interpolations. See {@link skipTemplate}. */
const maxTemplateNesting = 64;

/**
 * Skip a `'...'` or `"..."` string starting at `i`.
 *
 * Returns the index past the closing quote, or `-1` when the literal never
 * closes *on its line*. JavaScript string literals cannot contain a raw
 * newline, so a quote with no partner before the line ends was never a string
 * to begin with — it's an apostrophe in prose (`Let's`, `don't`) or a stray
 * quote in markup. Reporting that instead of consuming to the next quote is
 * what keeps a contraction in JSX text from swallowing the code after it.
 */
function skipString(code: string, i: number, quote: string): number {
  i += 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    // A real string literal never spans a raw line break, so this is prose, not code.
    if (c === "\n" || c === "\r") return -1;
    i += 1;
  }
  return -1;
}

/** Skip a `` `...` `` template starting at `i`, including balanced `${ ... }`; returns index past the backtick. */
function skipTemplate(code: string, i: number, nesting = 0): number {
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
          const end = skipString(code, i, d);
          if (end !== -1) {
            i = end;
            continue;
          }
        } else if (d === "`") {
          // A template nested inside an interpolation recurses. This function is fed
          // arbitrary bytes from every file in the project, so the nesting has to be
          // bounded: without it a pathological run of backticks overflows the stack,
          // and a `RangeError` here escapes the whole CSS transform and fails the
          // build. At the bound we step over the backtick instead, degrading to the
          // over-approximation this module already accepts everywhere else. Real code
          // nests three or four deep.
          i = nesting < maxTemplateNesting ? skipTemplate(code, i, nesting + 1) : i + 1;
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
    // Either newline character ends the comment. `\r` matters on its own because a
    // lone CR still terminates a line in some sources, and treating it as ordinary
    // text would let one `//` swallow the rest of the file — and every call in it.
    while (i < code.length && code[i] !== "\n" && code[i] !== "\r") i += 1;
    return i;
  }
  if (code[i] === "/" && code[i + 1] === "*") {
    i += 2;
    while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i += 1;
    return Math.min(i + 2, code.length);
  }
  return i;
}

/**
 * Skip whitespace and comments starting at `i`; returns the index of the first
 * character that is neither.
 */
function skipTrivia(text: string, i: number): number {
  while (i < text.length) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v") {
      i += 1;
      continue;
    }
    const j = skipComment(text, i);
    if (j === i) break;
    i = j;
  }
  return i;
}

/**
 * Read a parenthesized argument list; `open` points at the `(`. Returns the text
 * between the parens.
 *
 * Running to the end of the input still yields what was read: that is a file the
 * dev server caught mid-keystroke, and its finished calls should keep their
 * styles. Running past {@link maxArgsLength} yields nothing instead — that much
 * text is not an argument list, so the `(` belonged to something else and
 * whatever follows would only add noise.
 */
function readParen(code: string, open: number): string {
  const capped = open + 1 + maxArgsLength;
  const limit = Math.min(code.length, capped);
  const start = open + 1;
  let i = start;
  let depth = 1;
  while (i < limit) {
    const c = code[i];
    if (c === "'" || c === '"') {
      const end = skipString(code, i, c);
      if (end !== -1) {
        i = end;
        continue;
      }
    } else if (c === "`") {
      i = skipTemplate(code, i);
      continue;
    } else {
      const j = skipComment(code, i);
      if (j !== i) {
        i = j;
        continue;
      }
    }
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(start, i);
    }
    i += 1;
  }
  return i === capped ? "" : code.slice(start, i);
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
      const end = skipString(text, i, c);
      if (end !== -1) {
        i = end;
        sawContent = true;
        continue;
      }
    } else if (c === "`") {
      i = skipTemplate(text, i);
      sawContent = true;
      continue;
    } else {
      const j = skipComment(text, i);
      if (j !== i) {
        i = j;
        continue;
      }
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
      // Unterminated on its line: an apostrophe in prose, not a literal.
      if (end === -1) {
        i += 1;
        continue;
      }
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
  // A missing `}` means the file was read mid-save, or the arg list hit the cap.
  // Parse what is there rather than dropping the whole object.
  const close = t.lastIndexOf("}");
  const inner = close > 0 ? t.slice(1, close) : t.slice(1);

  const props: Array<{ key: string; value: string }> = [];
  for (const raw of splitArgs(inner)) {
    // A comment ahead of the key belongs to neither — and gluing it on would turn
    // `lg` into `// note\n lg`, whose candidate has whitespace and is dropped. That
    // is a silent style loss for the very common habit of annotating a breakpoint.
    const entry = raw.slice(skipTrivia(raw, 0));
    if (entry === "" || entry.startsWith("...")) continue;
    const colon = topLevelColon(entry);
    if (colon === -1) continue;
    const key = normalizeKey(entry.slice(0, colon).trim());
    if (key == null) continue;
    props.push({ key, value: entry.slice(colon + 1).trim() });
  }
  return props;
}

/** Index of the first `:` at bracket depth 0 (outside strings and comments), or -1. */
function topLevelColon(entry: string): number {
  let depth = 0;
  let i = 0;
  while (i < entry.length) {
    const c = entry[i];
    if (c === "'" || c === '"') {
      const end = skipString(entry, i, c);
      if (end !== -1) {
        i = end;
        continue;
      }
    } else if (c === "`") {
      i = skipTemplate(entry, i);
      continue;
    } else {
      // A `:` inside a comment must not be mistaken for the key separator.
      const j = skipComment(entry, i);
      if (j !== i) {
        i = j;
        continue;
      }
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

/**
 * Index just past the `}` that closes the `{` at `open`, or the end of `text`.
 *
 * Running to the end still counts as a match: that is a file the dev server read
 * mid-keystroke, and the buckets already written in it should keep their styles.
 */
function matchBrace(text: string, open: number): number {
  let i = open + 1;
  let depth = 1;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const end = skipString(text, i, c);
      if (end !== -1) {
        i = end;
        continue;
      }
    } else if (c === "`") {
      i = skipTemplate(text, i);
      continue;
    } else {
      const j = skipComment(text, i);
      if (j !== i) {
        i = j;
        continue;
      }
    }
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return text.length;
}

/**
 * Every `{ … }` region in `text` that is a bucket map rather than an array
 * element, in source order.
 *
 * An `ss` argument — or a bucket's value — is often not the object itself:
 * `cond && { md: "p-6" }` and `cond ? { md: "p-6" } : { md: "p-2" }` are ordinary
 * ways to write one, and reading only text that *starts* with `{` drops their
 * classes. Silently, too: the class still reaches the element, there is just no
 * CSS behind it. So every brace group is taken, and both branches of a ternary
 * are enumerated, as everywhere else in this module.
 *
 * Braces inside `[ … ]` are skipped, because at runtime an object inside an array
 * is a `clsx` dictionary, not a nested map — its keys are class names, and the
 * caller reads them as such.
 */
export function objectLiterals(text: string): string[] {
  const out: string[] = [];
  let brackets = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const end = skipString(text, i, c);
      if (end !== -1) {
        i = end;
        continue;
      }
    } else if (c === "`") {
      i = skipTemplate(text, i);
      continue;
    } else {
      const j = skipComment(text, i);
      if (j !== i) {
        i = j;
        continue;
      }
    }
    if (c === "[") brackets += 1;
    else if (c === "]") {
      if (brackets > 0) brackets -= 1;
    } else if (c === "{" && brackets === 0) {
      const end = matchBrace(text, i);
      out.push(text.slice(i, end));
      i = end;
      continue;
    }
    i += 1;
  }
  return out;
}

/** The identifier immediately before the `(` at `i`, or `""` for a grouping paren. */
function calleeBefore(text: string, i: number): string {
  let j = i - 1;
  while (j >= 0) {
    const c = text[j] as string;
    if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") break;
    j -= 1;
  }
  const end = j + 1;
  while (j >= 0 && /[\w$]/.test(text[j] as string)) j -= 1;
  return text.slice(j + 1, end);
}

/**
 * Every statically-known property key of the `{ … }` groups in `text` that sit
 * where a *class value* goes.
 *
 * A `clsx` dictionary spells a class as a **key** — `{ hidden: !open }` — so the
 * class never appears as a string literal and the sweep that collects those cannot
 * see it, while the runtime emits it like any other class. Shorthand counts too:
 * `{ hidden }` is `{ hidden: hidden }` and produces the same class.
 *
 * Which groups qualify is exactly the runtime's own rule, because the same syntax
 * means different things in different places:
 *
 * - inside an array, or inside `cn(…)` / `clsx(…)`, an object is always a
 *   dictionary — that is the documented way to write one;
 * - inside any *other* call it is not. `match(size, { sm: "p-1" })` is a lookup
 *   whose keys are discriminant values, and reading them as classes would safelist
 *   a rule for every variant name in the project;
 * - standing on its own it depends on the caller, which is what `bare` says. For
 *   `on`/`until`/`data`/… the argument is a class value, so it is a dictionary;
 *   in an `ss` bucket the same object is a nested bucket map, and
 *   {@link parseObject} reads those keys as variants instead.
 */
export function dictionaryKeys(text: string, bare: boolean): string[] {
  const out: string[] = [];
  // `regions` counts enclosing class-value scopes, `foreign` enclosing calls that
  // are neither; a plain grouping paren is transparent to both.
  const frames: string[] = [];
  let regions = 0;
  let foreign = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const end = skipString(text, i, c);
      if (end !== -1) {
        i = end;
        continue;
      }
    } else if (c === "`") {
      i = skipTemplate(text, i);
      continue;
    } else {
      const j = skipComment(text, i);
      if (j !== i) {
        i = j;
        continue;
      }
    }

    if (c === "{") {
      const end = matchBrace(text, i);
      if (foreign === 0 && (regions > 0 || bare)) collectKeys(text.slice(i, end), out);
      i = end;
      continue;
    }

    if (c === "[") {
      frames.push("region");
      regions += 1;
    } else if (c === "(") {
      const callee = calleeBefore(text, i);
      if (callee === "cn" || callee === "clsx") {
        frames.push("region");
        regions += 1;
      } else if (callee === "") {
        frames.push("plain");
      } else {
        frames.push("foreign");
        foreign += 1;
      }
    } else if (c === "]" || c === ")") {
      const frame = frames.pop();
      if (frame === "region") regions -= 1;
      else if (frame === "foreign") foreign -= 1;
    }
    i += 1;
  }
  return out;
}

/** Push the statically-known keys of one `{ … }` group onto `out`. */
function collectKeys(group: string, out: string[]): void {
  const close = group.lastIndexOf("}");
  const inner = close > 0 ? group.slice(1, close) : group.slice(1);
  for (const raw of splitArgs(inner)) {
    const entry = raw.slice(skipTrivia(raw, 0));
    if (entry === "" || entry.startsWith("...")) continue;
    const colon = topLevelColon(entry);
    // No colon is shorthand — `{ hidden }` — whose key is also its value.
    const key = normalizeKey(colon === -1 ? entry : entry.slice(0, colon).trim());
    if (key !== null) out.push(key);
  }
}

/**
 * True if `text` is nothing but one object literal.
 *
 * Such a value is a bucket map and only a bucket map, so its own text carries no
 * classes — which is what lets the caller skip the over-approximating token sweep
 * and avoid emitting candidates the runtime can never produce.
 */
export function isObjectLiteral(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") && matchBrace(t, 0) === t.length;
}

/** True if `text` (trimmed) is an array literal. */
export function isArrayLiteral(text: string): boolean {
  return text.trim().startsWith("[");
}

/**
 * Scan source code for tailess helper calls (bare or as a method, e.g. `st.ss`)
 * and return each with its raw top-level arguments. Nested calls are found too,
 * since the search covers the argument text as well.
 *
 * The search deliberately looks only at the call site, never at what surrounds
 * it. Tracking JavaScript context across a whole file cannot work here: the
 * files we scan are mostly *not* JavaScript. In `.vue`, `.svelte`, `.html`,
 * `.astro` and `.md` — and in the JSX half of a `.tsx` file — a quote is usually
 * an attribute delimiter or an apostrophe in prose, not a string literal. Read
 * as JavaScript, `<div>Let's go</div>` opens a string that runs to the next
 * apostrophe in the file, and every tailess call in between disappears. That is
 * a silent failure of exactly the kind this package exists to prevent: the class
 * still lands on the element, it just has no CSS.
 *
 * So a helper name inside a string or a comment is matched too, and yields
 * candidates. That is the trade this module already makes everywhere else —
 * `@source inline(...)` ignores a candidate that matches no utility, so an extra
 * one costs a moment of compile time, while a missing one costs the user a
 * broken layout they cannot debug.
 */
export function scanCalls(code: string): RawCall[] {
  const calls: RawCall[] = [];
  callPattern.lastIndex = 0;
  for (let match = callPattern.exec(code); match !== null; match = callPattern.exec(code)) {
    const name = match[1];
    if (name === undefined) continue;
    // The pattern ends at the `(`, so the match's last character is the paren.
    const open = match.index + match[0].length - 1;
    calls.push({ name, args: splitArgs(readParen(code, open)) });
  }
  return calls;
}

/**
 * Like {@link scanCalls}, but skipping the calls that sit inside another matched
 * call's arguments.
 *
 * Reporting every descendant is right when the whole file is the input — that is
 * what makes a nested call yield its own candidates. Following a *bucket value* is
 * different: the walk recurses into each call it finds, so reporting descendants
 * alongside their ancestor would visit the same call once per ancestor, and a
 * chain of nested calls would cost exponentially more than it is long.
 */
export function outerCalls(code: string): RawCall[] {
  const calls: RawCall[] = [];
  outerCallPattern.lastIndex = 0;
  for (
    let match = outerCallPattern.exec(code);
    match !== null;
    match = outerCallPattern.exec(code)
  ) {
    const name = match[1];
    if (name === undefined) continue;
    const open = match.index + match[0].length - 1;
    const args = readParen(code, open);
    calls.push({ name, args: splitArgs(args) });
    // Resume past this call's own arguments; the recursion reaches what is inside
    // them through this call rather than beside it.
    outerCallPattern.lastIndex = Math.max(outerCallPattern.lastIndex, open + 1 + args.length);
  }
  return calls;
}

/// <reference types="node" />
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { maskLiterals } from "../extract/scan.js";
import { jsonResult } from "./result.js";

/**
 * `tailess init` and `tailess doctor` — the two commands that exist because setup is
 * the one failure nothing else can catch.
 *
 * Wiring the plugin is four hand-edited variants across two config shapes, ordering
 * matters in one of them, and getting it wrong produces no build error at all: the
 * classes reach the element and no rule is generated, which is discovered in a browser
 * rather than in CI. `doctor` reads the project and says which one it needs and whether
 * it has it; `init` writes that edit, after showing it.
 */

/** How this project gets Tailwind, which decides which plugin it needs. */
export type Host =
  | { kind: "vite"; file: string; source: string }
  | { kind: "postcss"; file: string; source: string }
  | { kind: "unknown" };

const viteConfig = /^vite\.config\.[cm]?[jt]s$/;
const postcssConfig = /^postcss\.config\.[cm]?[jt]s$/;
/** A `postcss.config.json` or a `.postcssrc`, which are data rather than code. */
const postcssData = /^(?:\.postcssrc(?:\.json)?|postcss\.config\.json)$/;

/**
 * The name `code` binds `specifier` to, when it imports it at all.
 *
 * `import tailess from "tailess/vite"`, `import { default as tw } from …` (the same binding
 * spelled out), `const tailess = require(…)` and TypeScript's `import tailess = require(…)`.
 */
function bindingOf(code: string, specifier = "tailess/vite"): string | undefined {
  const esm = new RegExp(
    `import\\s+(?:([\\w$]+)\\s*(?:,[^\\n]*?)?|\\{\\s*default\\s+as\\s+([\\w$]+)\\s*(?:,[^}]*)?\\})\\s*from\\s*["']${specifier}["']`,
  ).exec(code);
  if (esm) return esm[1] ?? esm[2];
  const cjs = new RegExp(
    `(?:(?:const|let|var)\\s+([\\w$]+)\\s*=|import\\s+([\\w$]+)\\s*=)\\s*require\\(\\s*["']${specifier}["']`,
  ).exec(code);
  return cjs ? (cjs[1] ?? cjs[2]) : undefined;
}

/** `key:` just before an object — the object is that property's value. `? x : {` is not. */
const propertyKey = /[{,]\s*([\w$]+|"[^"]*"|'[^']*'|\[[^\]]*\])\s*:\s*$/;

/**
 * True when `at` lies inside an object that is some option's value, rather than in the
 * config object itself: `build.rollupOptions.plugins`, `css.postcss.plugins`,
 * `optimizeDeps.esbuildOptions.plugins`.
 *
 * Read from the brackets around it in `blank` — {@link maskLiterals} with the strings
 * blanked too, so a bracket in a string is not counted. An object that is a property's
 * value is an option; one passed to `defineConfig(`, returned, or assigned is the config.
 * A tailess plugin in `rollupOptions.plugins` builds, but Vite ignores its dev-server
 * hooks, so every variant class is unstyled in dev with nothing printed.
 */
function insideOption(blank: string, at: number): boolean {
  let depth = 0;
  for (let i = at - 1; i >= 0; i -= 1) {
    const c = blank[i];
    if (c === ")" || c === "]" || c === "}") depth += 1;
    else if (c === "(" || c === "[" || c === "{") {
      if (depth > 0) depth -= 1;
      else if (c === "{" && propertyKey.test(blank.slice(Math.max(0, i - 200), i))) return true;
    }
  }
  return false;
}

/**
 * True when the Vite plugin is called in the config, not in an option nested inside it.
 *
 * `tailess()` by whatever name it was imported as, or `require("tailess/vite")()` inline.
 */
function viteWired(code: string, blank: string): boolean {
  const name = (bindingOf(code) ?? "tailess").replace(/\$/g, "\\$");
  const calls = new RegExp(
    `(?<![\\w$.])${name}\\s*\\(|\\brequire\\s*\\(\\s*["']tailess/vite["']\\s*\\)\\s*\\(`,
    "g",
  );
  for (const call of code.matchAll(calls)) {
    if (!insideOption(blank, call.index ?? 0)) return true;
  }
  return false;
}

/**
 * Where a PostCSS config puts `specifier` in its plugin list, as an offset — or -1.
 *
 * A string key or element counts unless its value is `false`, which is how both
 * postcss-load-config and Next.js switch a plugin off. `require(…)` inline counts. An
 * import or a `require` into a name does not by itself — the name has to be used, which
 * is the Vite rule too: an import a deleted `tailess()` left behind is not wiring, and
 * reading it as wiring passed `doctor` and `check --strict` on a build with no variant CSS.
 */
function postcssUse(code: string, blank: string, specifier: string): number {
  let first = -1;
  const use = (at: number) => {
    if (first === -1 || at < first) first = at;
  };
  for (const match of code.matchAll(new RegExp(`["']${specifier}["']`, "g"))) {
    const at = match.index ?? 0;
    const before = code.slice(Math.max(0, at - 200), at);
    const into =
      /(?:(?:const|let|var)\s+([\w$]+)\s*=|import\s+([\w$]+)\s*=)\s*require\s*\(\s*$/.exec(
        before,
      ) ??
      /import\s+(?!type\s)(?:([\w$]+)|\{\s*default\s+as\s+([\w$]+)[^}]*\})[^;]*?\bfrom\s*$/.exec(
        before,
      );
    if (into) {
      const name = (into[1] ?? into[2] ?? "").replace(/\$/g, "\\$");
      const names = [...blank.matchAll(new RegExp(`(?<![\\w$.])${name}(?![\\w$])`, "g"))];
      // The declaration is the last mention before the specifier; any other is a use.
      const declared = names.filter((m) => (m.index ?? 0) < at).pop();
      for (const m of names) if (m !== declared) use(m.index ?? 0);
      continue;
    }
    if (/\bimport\s*\(?\s*$|\bfrom\s*$/.test(before)) continue;
    const inline = /\brequire\s*\(\s*$/.exec(before);
    if (inline) use(at - before.length + inline.index);
    else if (!/^\s*:\s*false\b/.test(code.slice(at + match[0].length))) use(at);
  }
  return first;
}

/** How a config stands: wired, not wired, or — PostCSS — wired after Tailwind's plugin. */
export type Wiring = "wired" | "unwired" | "misordered";

/**
 * How `text` wires tailess in, read as a config of `kind` — or, with none, as either.
 *
 * The Vite plugin has to be *called*: deleting `tailess()` from the `plugins` array and
 * leaving the import behind is exactly the shape this exists to catch, and reading for
 * the word alone would have called that wired. The import is read only to learn what the
 * plugin was bound to, so an aliased one is not a false alarm. The PostCSS plugin has to
 * be in the list, and ahead of `@tailwindcss/postcss`: it writes the candidate list that
 * plugin reads, so second is the same as absent — and the build prints no error either way.
 *
 * Read against {@link maskLiterals} rather than the raw text, because the same deletion
 * that leaves an import behind leaves a comment behind — `// we removed tailess()` — and
 * matching that reports a genuinely unwired project as wired. This is the one failure
 * that unstyles a whole application with no build error, so the check that catches it
 * must not be readable by prose.
 */
export function wiring(text: string, kind?: "vite" | "postcss"): Wiring {
  const code = maskLiterals(text);
  const blank = maskLiterals(text, true);
  if (kind !== "postcss" && viteWired(code, blank)) return "wired";
  if (kind === "vite") return "unwired";
  const tailess = postcssUse(code, blank, "tailess/postcss");
  if (tailess === -1) return "unwired";
  const tailwind = postcssUse(code, blank, "@tailwindcss/postcss");
  return tailwind !== -1 && tailwind < tailess ? "misordered" : "wired";
}

/** True when {@link wiring} says `text` is wired. */
export function wired(text: string, kind?: "vite" | "postcss"): boolean {
  return wiring(text, kind) === "wired";
}

/**
 * Which plugin `text`, a config file called `name`, has to wire — `undefined` for either.
 *
 * A Vite config that loads `@tailwindcss/postcss` rather than `@tailwindcss/vite` runs
 * Tailwind through PostCSS, where `tailess/postcss` is the right plugin. One that loads
 * `@tailwindcss/vite` needs the Vite plugin, and `tailess/postcss` in its `css.postcss`
 * cannot work — the README's own warning, which reading either plugin as wiring passed.
 */
export function pluginFor(name: string, text: string): "vite" | "postcss" | undefined {
  if (viteConfig.test(name)) {
    const code = maskLiterals(text);
    const postcssOnly =
      /["']@tailwindcss\/postcss["']/.test(code) && !/["']@tailwindcss\/vite["']/.test(code);
    return postcssOnly ? undefined : "vite";
  }
  if (postcssConfig.test(name) || /^\.postcssrc/.test(name) || name === "package.json") {
    return "postcss";
  }
  if (postcssData.test(name)) return "postcss";
  return undefined;
}

/**
 * Which integration this project needs.
 *
 * A `vite.config` means `@tailwindcss/vite`, and the Vite plugin. A `postcss.config`
 * means the PostCSS one — including Next.js, which is the most common case of all and
 * has no Vite config to find. When both exist, Vite wins: a Vite project with a
 * `postcss.config` still compiles its CSS through Vite.
 */
export async function findHost(cwd: string): Promise<Host> {
  const names = await readdir(cwd).catch(() => [] as string[]);
  const read = async (name: string) => ({
    file: join(cwd, name),
    source: await readFile(join(cwd, name), "utf8").catch(() => ""),
  });

  const vite = names.find((name) => viteConfig.test(name));
  if (vite) return { kind: "vite", ...(await read(vite)) };

  const postcss = names.find((name) => postcssConfig.test(name) || postcssData.test(name));
  if (postcss) return { kind: "postcss", ...(await read(postcss)) };

  return { kind: "unknown" };
}

/** What `init` would write, or `null` when there is nothing to change. */
export interface Edit {
  file: string;
  before: string;
  after: string;
}

/** The `plugins: [...]` array a plugin is added to the front of. */
const pluginsArray = /\bplugins\s*:\s*\[/;
/** The `plugins: { ... }` object a PostCSS plugin is added to the front of. */
const pluginsObject = /\bplugins\s*:\s*\{/;

/**
 * Where a top-level `import` statement starts: at the start of a line. `import(` and
 * `import.meta` are excluded: those are expressions, and can be anywhere.
 */
const importStart = /^[ \t]*import\b(?!\s*[.(])/gm;
/**
 * What may stand between `import` and its module specifier: nothing (a side-effect
 * import), a clause ending in `from`, or TypeScript's `x = require(`. Anything else —
 * `import type Alias = A.B` — has no specifier, and the next quote belongs to someone else.
 */
const importClause = /^(?:\s*|[\s\w$,{}*]*\bfrom\s*|\s*(?:type\s+)?[\w$]+\s*=\s*require\s*\(\s*)$/;

/**
 * Where the top-level import that starts at `from` ends, or -1 when it cannot be read.
 *
 * Walked rather than matched, because the specifier is not always the end: `import pkg
 * from "./package.json" with { type: "json" }` carries an attributes clause after it,
 * `import path = require("node:path")` a closing parenthesis, and splicing at the
 * specifier cut both statements in two. Multi-line imports are what a formatter produces
 * past its print width, so the specifier is found across lines rather than on the first.
 */
function importEnd(masked: string, from: number): number {
  const open = masked.slice(from).search(/["']/);
  if (open === -1 || !importClause.test(masked.slice(from, from + open))) return -1;
  const close = masked.indexOf(masked[from + open] as string, from + open + 1);
  if (close === -1) return -1;
  let end = close + 1;
  for (const tail of [/^[ \t]*\)/, /^\s*(?:with|assert)\s*\{[^}]*\}/, /^[ \t]*;/]) {
    const found = tail.exec(masked.slice(end));
    if (found) end += found[0].length;
  }
  return end;
}

/** Splice `text` into `source` at `at`. */
function insertAt(source: string, at: number, text: string): string {
  return source.slice(0, at) + text + source.slice(at);
}

/** True when the list opened just before `at` is empty, so the entry needs no separator. */
function listIsEmpty(masked: string, at: number, close: string): boolean {
  return masked.slice(at).trimStart().startsWith(close);
}

/**
 * Where a new top-level import can go: after the last existing one, or — when there is
 * none — in front of the first real token, which leaves a leading comment or a
 * `/// <reference>` where it has to stay.
 */
function importInsertPoint(masked: string): number {
  let end = -1;
  for (const match of masked.matchAll(importStart)) {
    end = Math.max(end, importEnd(masked, (match.index ?? 0) + match[0].length));
  }
  return end !== -1 ? end : firstToken(masked);
}

/** The first real token, past a BOM, leading comments and a `"use strict"` directive. */
function firstToken(masked: string): number {
  const directive = /^\s*(["'])use strict\1[ \t]*;?/.exec(masked);
  if (directive) return directive[0].length;
  const at = masked.search(/\S/);
  return at === -1 ? masked.length : at;
}

/** A top-level `const x = require("…")` line — what a CommonJS config imports with. */
const topLevelRequire =
  /^[ \t]*(?:const|let|var)\s+[^=;\n]+=\s*require\s*\(\s*["'][^"'\n]*["']\s*\)[^;\n]*;?/gm;

/** Where a new `require` line goes: after the last one, or at the first real token. */
function requireInsertPoint(masked: string): number {
  let end = -1;
  for (const match of masked.matchAll(topLevelRequire)) end = (match.index ?? 0) + match[0].length;
  return end !== -1 ? end : firstToken(masked);
}

/** An ESM statement at the start of a line — what makes a `.js` config a module. */
const esmSyntax = /^[ \t]*(?:import\b(?!\s*[.(])|export\b)/m;

/**
 * True when the config is CommonJS, so an `import` statement cannot go in it.
 *
 * A `.cjs` file always is. A `.js`, `.ts` or `.cts` one is when it has no ESM statement
 * and uses `require` or `module.exports` — the README documents that shape, and an
 * `import` prepended to it stopped Vite loading the config at all.
 */
function isCommonJs(file: string, masked: string): boolean {
  if (/\.cjs$/.test(file)) return true;
  if (/\.m[jt]s$/.test(file)) return false;
  return !esmSyntax.test(masked) && /\brequire\s*\(|\bmodule\.exports\b/.test(masked);
}

/**
 * The edit that wires the plugin in, or `null` when it cannot be written safely.
 *
 * Deliberately narrow: it inserts into a `plugins: [` array and a `plugins: {` object,
 * and gives up on anything else rather than guessing at a config it does not recognise.
 * A wrong edit to a build config is worse than no edit, and `doctor` still says what to
 * do by hand.
 *
 * Every position is found in {@link maskLiterals} of the source and spliced into the raw
 * text at that index, so a `plugins: [` inside a comment is neither edited nor counted.
 * The result is then read back with {@link wiring}: an edit that does not actually wire
 * the plugin in is not returned at all, however plausible its diff looks.
 */
export function planEdit(host: Host): Edit | null {
  // A plugin listed after Tailwind's is not one to add a second copy of: that is a reorder,
  // which `doctor` describes rather than this guessing at where the entry ends.
  if (host.kind === "unknown") return null;
  const kind = pluginFor(basename(host.file), host.source);
  if (kind !== host.kind || wiring(host.source, kind) !== "unwired") return null;

  const masked = maskLiterals(host.source);
  const blank = maskLiterals(host.source, true);
  // Match the file rather than forcing `\n` into it: a CRLF config edited with a bare
  // newline is left with mixed line endings, which every diff downstream then shows.
  const eol = host.source.includes("\r\n") ? "\r\n" : "\n";
  // Only the config's own lists. With `plugins` held in a variable, the one literal left
  // was `build.rollupOptions.plugins` or `css.postcss.plugins`, and writing there either
  // lost every variant class in dev with nothing printed or failed the build.
  const lists = (pattern: RegExp) =>
    [...masked.matchAll(new RegExp(pattern.source, "g"))].filter(
      (match) => !insideOption(blank, match.index ?? 0),
    );
  const entry = (listAt: number, close: string, text: string) =>
    insertAt(host.source, listAt, listIsEmpty(masked, listAt, close) ? text : `${text}, `);
  // An import left behind by a deleted call is the commonest unwired shape there is, and
  // adding a second one declared the same name twice: a config that no longer parses,
  // written after `doctor` recommended it. The binding that is there is reused, and a
  // `tailess` that is already something else is not declared a second time.
  const nameFor = (specifier: string) => {
    const bound = bindingOf(masked, specifier);
    if (bound) return { name: bound, bound: true };
    return /(?<![\w$.])tailess\b/.test(blank) ? undefined : { name: "tailess", bound: false };
  };
  let after: string | null;

  if (host.kind === "vite") {
    const found = lists(pluginsArray);
    const list = found.length === 1 ? found[0] : undefined;
    const binding = nameFor("tailess/vite");
    if (!list || !binding) return null;
    // Later position first, so the earlier index is still valid when it is used.
    const listAt = (list.index ?? 0) + list[0].length;
    after = entry(listAt, "]", `${binding.name}()`);
    if (!binding.bound) after = withImport(after, masked, host.file, eol, "tailess/vite", listAt);
  } else {
    // PostCSS: order matters, so tailess goes first — it has to write the candidate list
    // before Tailwind reads it.
    const found = [...lists(pluginsObject), ...lists(pluginsArray)];
    // A `"tailess/postcss": false` already there wins over a key added in front of it —
    // the later duplicate is the one an object literal keeps — so the plugin would stay
    // off after an edit that read as wiring it.
    if (found.length !== 1 || /["']tailess\/postcss["']\s*:\s*false\b/.test(masked)) return null;
    const list = found[0] as RegExpMatchArray;
    const listAt = (list.index ?? 0) + list[0].length;
    if (list[0].endsWith("{")) {
      const empty = listIsEmpty(masked, listAt, "}");
      after = insertAt(host.source, listAt, `${eol}    "tailess/postcss": {}${empty ? "" : ","}`);
    } else {
      // An array holds strings for Next.js and plugin instances for postcss-load-config,
      // and each loader rejects the other's: a string put in front of
      // `require("@tailwindcss/postcss")()` is "Invalid PostCSS Plugin found at:
      // plugins[0]". The entries already there say which one reads it; an empty array
      // says nothing, so it is left alone.
      const head = masked.slice(listAt).trimStart();
      if (/^["']/.test(head)) after = entry(listAt, "]", '"tailess/postcss"');
      else if (!/^[\w$]/.test(head)) return null;
      else if (isCommonJs(host.file, masked)) {
        after = entry(listAt, "]", 'require("tailess/postcss")()');
      } else {
        const binding = nameFor("tailess/postcss");
        if (!binding) return null;
        after = entry(listAt, "]", `${binding.name}()`);
        if (!binding.bound) {
          after = withImport(after, masked, host.file, eol, "tailess/postcss", listAt);
        }
      }
    }
  }

  // The point of the command is a config that works afterwards. Anything less is a hand
  // edit `doctor` describes, not a file this writes.
  if (after === null || wiring(after, host.kind) !== "wired") return null;
  return { file: host.file, before: host.source, after };
}

/**
 * `after` with `import tailess from "<specifier>"` added — or the `require` line, in a
 * CommonJS config — or `null` when the only place for it is past `limit`, the list entry
 * that uses it.
 */
function withImport(
  after: string,
  masked: string,
  file: string,
  eol: string,
  specifier: string,
  limit: number,
): string | null {
  const cjs = isCommonJs(file, masked);
  const at = cjs ? requireInsertPoint(masked) : importInsertPoint(masked);
  if (at > limit) return null;
  const statement = cjs
    ? `const tailess = require("${specifier}");`
    : `import tailess from "${specifier}";`;
  // Leading, when nothing but trivia precedes the insertion point; trailing otherwise, so
  // the new line follows the import it is placed after rather than splitting it.
  const text = masked.slice(0, at).trim() === "" ? `${statement}${eol}` : `${eol}${statement}`;
  return insertAt(after, at, text);
}

/** Parse `text` as the file `file`, answering with the first syntax error or `null`. */
type Parse = (file: string, text: string) => Promise<string | null>;

/**
 * The parser of the Vite this project has, or `undefined` when it has none.
 *
 * The project's own, because that is the one that will load the config: Vite 8 ships
 * oxc's `parseSync`, which reads TypeScript, and Vite 5–7 ship `transformWithEsbuild`.
 * The ESM entry is imported rather than resolved with `require`, which in Vite 5 picks
 * the CJS build and prints its deprecation notice into the command's output.
 */
async function hostParser(cwd: string): Promise<Parse | undefined> {
  let entry: string;
  try {
    const manifest = createRequire(join(cwd, "_")).resolve("vite/package.json");
    const pkg = JSON.parse(await readFile(manifest, "utf8")) as {
      exports?: { "."?: string | { import?: string | { default?: string } } };
      module?: string;
      main?: string;
    };
    const dot = pkg.exports?.["."];
    const esm = typeof dot === "string" ? dot : dot?.import;
    const path = (typeof esm === "string" ? esm : esm?.default) ?? pkg.module ?? pkg.main;
    if (!path) return undefined;
    entry = join(dirname(manifest), path);
  } catch {
    return undefined;
  }
  const vite = (await import(pathToFileURL(entry).href).catch(() => undefined)) as
    | {
        parseSync?: (file: string, text: string) => { errors?: { message?: string }[] };
        transformWithEsbuild?: (text: string, file: string) => Promise<unknown>;
      }
    | undefined;
  const { parseSync, transformWithEsbuild } = vite ?? {};
  if (typeof parseSync === "function") {
    return async (file, text) => {
      const error = parseSync(file, text).errors?.[0];
      return error ? (error.message ?? "syntax error") : null;
    };
  }
  if (typeof transformWithEsbuild === "function") {
    return (file, text) =>
      transformWithEsbuild(text, file).then(
        () => null,
        (error: unknown) => (error instanceof Error ? error.message : String(error)),
      );
  }
  return undefined;
}

/**
 * Why `edit` must not be written, or `undefined` when nothing says so.
 *
 * Every edit this command has ever written wrongly was one its own text matching
 * thought was fine, so the result is parsed as well, where the project has a parser to
 * do it with. Only a config that parsed *before* the edit and does not after is refused:
 * a parser that cannot read the original — an older Vite, a syntax it predates — has
 * nothing to say about the edit, and blocking on it would refuse working configs.
 */
export async function checkEdit(edit: Edit, cwd: string): Promise<string | undefined> {
  const parse = await hostParser(cwd);
  if (!parse) return undefined;
  const broken = await parse(edit.file, edit.after);
  if (broken === null || (await parse(edit.file, edit.before)) !== null) return undefined;
  return broken;
}

/**
 * The lines that change, for showing before writing.
 *
 * A longest-common-subsequence walk rather than a running index: a *modified* line
 * throws the two sides out of step, and a naive comparison then reports every line
 * after it as new. Showing a wrong diff and then editing someone's build config on the
 * strength of it is worse than not offering the command.
 */
export function diffOf(edit: Edit): string {
  const before = edit.before.split("\n");
  const after = edit.after.split("\n");

  // lengths[i][j] = length of the LCS of before[i..] and after[j..].
  const lengths: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      (lengths[i] as number[])[j] =
        before[i] === after[j]
          ? ((lengths[i + 1] as number[])[j + 1] as number) + 1
          : Math.max(
              (lengths[i + 1] as number[])[j] as number,
              (lengths[i] as number[])[j + 1] as number,
            );
    }
  }

  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      i += 1;
      j += 1;
    } else if (
      ((lengths[i + 1] as number[])[j] as number) >= ((lengths[i] as number[])[j + 1] as number)
    ) {
      lines.push(`- ${before[i]}`);
      i += 1;
    } else {
      lines.push(`+ ${after[j]}`);
      j += 1;
    }
  }
  while (i < before.length) lines.push(`- ${before[i++]}`);
  while (j < after.length) lines.push(`+ ${after[j++]}`);
  return lines.join("\n");
}

/**
 * `tailess doctor` — read the project and say what it needs.
 *
 * `json` is honoured here for the same reason it is on `check`: `--help` lists it in the
 * shared option block and annotates the command-scoped flags, so its silence on the other
 * two read as "applies to all four" — and a CI job wiring `doctor --json` got prose on
 * stderr and an empty stdout, with nothing saying the flag had been ignored.
 */
export async function runDoctor(cwd: string, json = false): Promise<number> {
  const host = await findHost(cwd);
  const where = (file: string) => relative(cwd, file) || file;
  const say = (message: string, error = false) => {
    if (json) return;
    if (error) console.error(message);
    else console.log(message);
  };
  const done = (code: number, body: Record<string, unknown>): number => {
    if (json) console.log(jsonResult("doctor", code, body));
    return code;
  };

  if (host.kind === "unknown") {
    say(
      "[tailess] no vite.config or postcss.config here, so there is nothing to wire the " +
        "plugin into. Run this from the directory that holds your build config — in a " +
        "monorepo that is the app, not the root.",
      true,
    );
    return done(2, { error: "no-config" });
  }

  const state = wiring(host.source, pluginFor(basename(host.file), host.source));
  if (state === "wired") {
    say(`[tailess] ${where(host.file)} calls the plugin. Nothing to do.`);
    return done(0, { host: host.kind, file: where(host.file), wired: true });
  }

  if (state === "misordered") {
    // The ordering rule is the one this command prints for an unwired config, so passing
    // a config that breaks it contradicted its own advice — and the build only says so in
    // a log line nobody reads.
    say(
      `[tailess] ${where(host.file)} lists "tailess/postcss" after "@tailwindcss/postcss", ` +
        "so Tailwind reads the candidate list before tailess has written it and no variant " +
        "class on the page has CSS behind it. Move it first:",
      true,
    );
    say(`\n${handEdit(host)}`, true);
    return done(1, {
      host: host.kind,
      file: where(host.file),
      wired: false,
      order: "tailwind-first",
      fixable: false,
    });
  }

  const plan = planEdit(host);
  say(
    `[tailess] ${where(host.file)} does not call the plugin, so no variant class on the ` +
      "page has CSS behind it — and nothing else reports that: the build succeeds and the " +
      "class attributes are correct.",
    true,
  );
  say(
    plan
      ? "\nRun `npx tailess init` to add it, or add it by hand:"
      : "\nThis config is not one `tailess init` can edit safely. Add it by hand:",
    true,
  );
  say(`\n${handEdit(host)}`, true);
  return done(1, {
    host: host.kind,
    file: where(host.file),
    wired: false,
    fixable: plan !== null,
  });
}

/**
 * The lines to add by hand, in the shape this config is written in.
 *
 * A PostCSS list of plugin instances takes a call, not the string form: the string is
 * what Next.js reads, and postcss-load-config rejects it.
 */
function handEdit(host: Exclude<Host, { kind: "unknown" }>): string {
  const masked = maskLiterals(host.source);
  const cjs = isCommonJs(host.file, masked);
  if (host.kind === "vite") {
    return cjs
      ? '  const tailess = require("tailess/vite");\n  plugins: [tailwindcss(), tailess()]'
      : '  import tailess from "tailess/vite";\n  plugins: [tailwindcss(), tailess()]';
  }
  const order = "\n\ntailess must come first: it writes the candidate list Tailwind then reads.";
  const array = /\bplugins\s*:\s*\[\s*([^\s\]])/.exec(masked)?.[1];
  if (array !== undefined && !/["']/.test(array)) {
    return cjs
      ? `  plugins: [require("tailess/postcss")(), require("@tailwindcss/postcss")()]${order}`
      : `  import tailess from "tailess/postcss";\n  plugins: [tailess(), tailwindcss()]${order}`;
  }
  return `  plugins: { "tailess/postcss": {}, "@tailwindcss/postcss": {} }${order}`;
}

/** `tailess init` — write that edit, after showing it. */
export async function runInit(cwd: string, write: boolean, json = false): Promise<number> {
  const host = await findHost(cwd);
  const where = (file: string) => relative(cwd, file) || file;
  const say = (message: string, error = false) => {
    if (json) return;
    if (error) console.error(message);
    else console.log(message);
  };
  const done = (code: number, body: Record<string, unknown>): number => {
    if (json) console.log(jsonResult("init", code, body));
    return code;
  };

  if (host.kind === "unknown") {
    say(
      "[tailess] no vite.config or postcss.config here. Create the one your build uses " +
        "first — there is nothing to add the plugin to.",
      true,
    );
    return done(2, { error: "no-config" });
  }

  const state = wiring(host.source, pluginFor(basename(host.file), host.source));
  if (state === "wired") {
    say(`[tailess] ${where(host.file)} already calls the plugin. Nothing to do.`);
    return done(0, { file: where(host.file), wired: true, written: false });
  }
  if (state === "misordered") {
    say(
      `[tailess] ${where(host.file)} lists "tailess/postcss" after "@tailwindcss/postcss", ` +
        "which is the same as not listing it. Nothing was written: move it first by hand " +
        "— `npx tailess doctor` shows the line.",
      true,
    );
    return done(2, { error: "misordered", file: where(host.file) });
  }

  const plan = planEdit(host);
  if (!plan) {
    say(
      `[tailess] ${where(host.file)} has no plugins list this can edit safely, so nothing ` +
        "was written. `npx tailess doctor` prints the line to add.",
      true,
    );
    return done(2, { error: "not-editable", file: where(host.file) });
  }

  const broken = await checkEdit(plan, cwd);
  if (broken !== undefined) {
    say(
      `[tailess] the edit to ${where(plan.file)} would not parse (${broken}), so nothing ` +
        "was written. `npx tailess doctor` prints the line to add by hand.",
      true,
    );
    return done(2, { error: "not-editable", file: where(plan.file), reason: broken });
  }

  say(`[tailess] ${where(plan.file)}\n\n${diffOf(plan)}\n`);
  if (!write) {
    say("[tailess] nothing written. Re-run with --write to apply it.");
    return done(0, { file: where(plan.file), written: false, diff: diffOf(plan) });
  }

  await writeFile(plan.file, plan.after, "utf8");
  say(`[tailess] wrote ${where(plan.file)}. Restart your dev server.`);
  return done(0, { file: where(plan.file), written: true, diff: diffOf(plan) });
}

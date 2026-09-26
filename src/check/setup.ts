/// <reference types="node" />
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, sep } from "node:path";
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

/**
 * How this project gets Tailwind, which decides which plugin it needs.
 *
 * `framework` is set for a config that runs Vite itself — `astro.config`, `nuxt.config`,
 * SolidStart's `app.config` — with the Vite plugins under its `vite` key. `data` is set
 * for a PostCSS config that is JSON or YAML rather than code (`.postcssrc`, the
 * `package.json` key), whose `source` is then that config as JSON: something to read,
 * never to edit.
 */
export type Host =
  | { kind: "vite"; file: string; source: string; framework?: string }
  | { kind: "postcss"; file: string; source: string; data?: "json" | "yaml" | "package.json" }
  | { kind: "unknown" };

const viteConfig = /^vite\.config\.[cm]?[jt]s$/;
/** Configs that run Vite themselves, read like a Vite config for the plugin they need. */
const frameworkConfig = /^(?:astro|nuxt|app)\.config\.[cm]?[jt]s$/;
const postcssConfig = /^(?:postcss\.config|\.postcssrc)\.[cm]?[jt]s$/;
/** A `postcss.config.json` or a `.postcssrc`, which are data rather than code. */
const postcssData = /^(?:\.postcssrc(?:\.json|\.ya?ml)?|postcss\.config\.json)$/;

/** Vite's own lookup order, so the file read is the one Vite loads. */
const viteNames = ["js", "mjs", "ts", "cjs", "mts", "cts"].map((ext) => `vite.config.${ext}`);
/** The frameworks whose own config holds `vite.plugins`, and the file each one reads. */
const frameworks: [framework: string, stem: string][] = [
  ["Astro", "astro.config"],
  ["Nuxt", "nuxt.config"],
  ["SolidStart", "app.config"],
];
/** postcss-load-config's lookup order, after the `package.json` key it tries first. */
const postcssNames = [
  ".postcssrc",
  ".postcssrc.json",
  ".postcssrc.yaml",
  ".postcssrc.yml",
  ...["ts", "cts", "mts", "js", "cjs", "mjs"].map((ext) => `.postcssrc.${ext}`),
  ...["ts", "cts", "mts", "js", "cjs", "mjs"].map((ext) => `postcss.config.${ext}`),
  "postcss.config.json",
];

/**
 * The part of a YAML `.postcssrc` this reads: its `plugins:` block, as `name: value` or
 * `- name` lines, into the object postcss-load-config would build. Anything else in the
 * file is left out; a flow-style `plugins: { … }` is read as JSON.
 */
function readYaml(text: string): unknown {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/(?:^|\s)#.*$/, ""))
    .filter((line) => line.trim() !== "");
  const at = lines.findIndex((line) => /^plugins\s*:/.test(line));
  if (at === -1) return {};
  const inline = (lines[at] as string).replace(/^plugins\s*:\s*/, "");
  if (inline) return { plugins: JSON.parse(inline) as unknown };
  const body: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (!/^\s/.test(line)) break;
    body.push(line);
  }
  const depth = (line: string) => (/^\s*/.exec(line) as RegExpExecArray)[0].length;
  const indent = Math.min(...body.map(depth));
  const entries = body.filter((line) => depth(line) === indent).map((line) => line.trim());
  const unquote = (text: string) => text.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (entries.every((line) => line.startsWith("-"))) {
    return { plugins: entries.map((line) => unquote(line.slice(1))) };
  }
  const plugins: Record<string, unknown> = {};
  for (const line of entries) {
    const entry = /^("[^"]*"|'[^']*'|[^:]+?)\s*:\s*(.*)$/.exec(line);
    if (entry) plugins[unquote(entry[1] as string)] = entry[2] === "false" ? false : {};
  }
  return { plugins };
}

/** True when `text` names `specifier` as a module, outside comments. */
function mentions(text: string, specifier: string): boolean {
  return new RegExp(`["']${specifier}["']`).test(maskLiterals(text));
}

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
      else if (c === "{") {
        // `vite: {` is where Astro, Nuxt and SolidStart keep the Vite config, so the
        // `plugins` inside it are that config's own.
        const key = propertyKey.exec(blank.slice(Math.max(0, i - 200), i))?.[1];
        if (key !== undefined && key !== "vite") return true;
      }
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
  if (viteConfig.test(name) || frameworkConfig.test(name)) {
    const postcssOnly =
      mentions(text, "@tailwindcss/postcss") && !mentions(text, "@tailwindcss/vite");
    return postcssOnly ? undefined : "vite";
  }
  if (postcssConfig.test(name) || postcssData.test(name) || name === "package.json") {
    return "postcss";
  }
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
  const present = new Set(await readdir(cwd).catch(() => [] as string[]));
  const read = async (name: string) => ({
    file: join(cwd, name),
    source: await readFile(join(cwd, name), "utf8").catch(() => ""),
  });
  const postcss = await findPostcss(cwd, present);

  // Vite's order, not the directory's: with a stale `vite.config.cjs` beside the
  // `vite.config.ts` Vite loads, reading the first name `readdir` returned answered for
  // the wrong file.
  const vite = viteNames.find((name) => present.has(name));
  if (vite) {
    const host = { kind: "vite" as const, ...(await read(vite)) };
    // A Vite project can compile Tailwind through PostCSS instead, and the README calls
    // `tailess/postcss` the right plugin there — so asking for `tailess()` in the Vite
    // config failed a working build and `init` then added a redundant plugin.
    const viaPostcss =
      postcss !== undefined &&
      !mentions(host.source, "@tailwindcss/vite") &&
      mentions(postcss.source, "@tailwindcss/postcss");
    return viaPostcss ? postcss : host;
  }

  for (const [framework, stem] of frameworks) {
    const name = viteNames
      .map((file) => file.replace("vite.config", stem))
      .find((file) => present.has(file));
    if (!name) continue;
    const host = { kind: "vite" as const, framework, ...(await read(name)) };
    // `app.config` is SolidStart's only when it says so; Nuxt uses the name for something else.
    if (framework === "SolidStart" && !/@solidjs\/start|vinxi/.test(host.source)) continue;
    return host;
  }

  return postcss ?? { kind: "unknown" };
}

/**
 * The PostCSS config postcss-load-config would load here, in its order.
 *
 * `package.json`'s `postcss` key and the `.postcssrc` family were missed, so `doctor`
 * exited 2 on wired, working projects — "no postcss.config here" — and blamed the
 * directory for it. Those are read as data; only a code config is one `init` edits.
 */
async function findPostcss(
  cwd: string,
  present: Set<string>,
): Promise<Extract<Host, { kind: "postcss" }> | undefined> {
  if (present.has("package.json")) {
    const text = await readFile(join(cwd, "package.json"), "utf8").catch(() => "");
    let postcss: unknown;
    try {
      postcss = (JSON.parse(text) as { postcss?: unknown }).postcss;
    } catch {
      postcss = undefined;
    }
    if (postcss !== undefined) {
      const source = JSON.stringify(postcss, null, 2);
      return { kind: "postcss", file: join(cwd, "package.json"), source, data: "package.json" };
    }
  }
  const name = postcssNames.find((file) => present.has(file));
  if (!name) return undefined;
  const file = join(cwd, name);
  const text = await readFile(file, "utf8").catch(() => "");
  if (!postcssData.test(name)) return { kind: "postcss", file, source: text };
  const yaml = /\.ya?ml$/.test(name);
  try {
    // A bare `.postcssrc` is JSON or YAML, whichever parses.
    const parsed = yaml ? readYaml(text) : JSON.parse(text);
    return {
      kind: "postcss",
      file,
      source: JSON.stringify(parsed, null, 2),
      data: yaml ? "yaml" : "json",
    };
  } catch {
    try {
      if (!yaml && name === ".postcssrc") {
        return {
          kind: "postcss",
          file,
          source: JSON.stringify(readYaml(text), null, 2),
          data: "yaml",
        };
      }
    } catch {
      // Falls through to the raw text, which reads as unwired rather than crashing.
    }
    return { kind: "postcss", file, source: text, data: yaml ? "yaml" : "json" };
  }
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

/**
 * `source` with `text` added as the first entry of the list opened just before `at`,
 * laid out like the entries already there: on a line of its own at their indent when
 * they are one per line, inline otherwise. A fixed four-space line in a tab-indented
 * file, and `tailess(), ` trailing the `[` of a multi-line array, were diff noise in
 * exactly the edit people read before accepting it.
 */
function firstEntry(
  source: string,
  masked: string,
  at: number,
  close: string,
  text: string,
  eol: string,
): string {
  const rest = masked.slice(at);
  const pad = (/^[ \t]*/.exec(rest) as RegExpExecArray)[0].length;
  if (rest.slice(pad).startsWith(close)) {
    // Empty: `{ "tailess/postcss": {} }` and `[tailess()]`.
    const filled = close === "}" ? ` ${text} ` : text;
    return source.slice(0, at) + filled + source.slice(at + pad);
  }
  const next = /^[ \t]*\r?\n(?:[ \t]*\r?\n)*([ \t]*)(\S)/.exec(rest);
  if (!next) return insertAt(source, at + pad, `${text}, `);
  if (next[2] === close) return insertAt(source, at, text);
  return insertAt(source, at + pad, `${eol}${next[1]}${text},`);
}

/**
 * How the file writes its code, so an added line reads like its neighbours: the quote
 * its imports use, and whether its statements end in a semicolon.
 */
function styleOf(masked: string): { quote: string; semi: string } {
  const quote = /(?:\bfrom|^[ \t]*import|\brequire\s*\()\s*(["'])/m.exec(masked)?.[1] ?? '"';
  const semi = /;[ \t]*(?:\r?\n|$)/.test(masked) || !/\S/.test(masked) ? ";" : "";
  return { quote, semi };
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
  // A framework's own config and a JSON or YAML one are read, never written: their
  // shapes are not the two this edits, and a wrong edit is worse than none.
  if ((host.kind === "vite" && host.framework) || (host.kind === "postcss" && host.data)) {
    return null;
  }
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
    firstEntry(host.source, masked, listAt, close, text, eol);
  const { quote } = styleOf(masked);
  /** The quote the list's own string entries use, or the file's. */
  const quoteIn = (listAt: number) => /^\s*(["'])/.exec(masked.slice(listAt))?.[1] ?? quote;
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
    const q = quoteIn(listAt);
    if (list[0].endsWith("{")) {
      after = entry(listAt, "}", `${q}tailess/postcss${q}: {}`);
    } else {
      // An array holds strings for Next.js and plugin instances for postcss-load-config,
      // and each loader rejects the other's: a string put in front of
      // `require("@tailwindcss/postcss")()` is "Invalid PostCSS Plugin found at:
      // plugins[0]". The entries already there say which one reads it; an empty array
      // says nothing, so it is left alone.
      const head = masked.slice(listAt).trimStart();
      if (/^["']/.test(head)) after = entry(listAt, "]", `${q}tailess/postcss${q}`);
      else if (!/^[\w$]/.test(head)) return null;
      else if (isCommonJs(host.file, masked)) {
        after = entry(listAt, "]", `require(${quote}tailess/postcss${quote})()`);
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
  const { quote, semi } = styleOf(masked);
  const statement = cjs
    ? `const tailess = require(${quote}${specifier}${quote})${semi}`
    : `import tailess from ${quote}${specifier}${quote}${semi}`;
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
 * A shortest-edit-script walk rather than a running index: a *modified* line throws the
 * two sides out of step, and a naive comparison then reports every line after it as
 * new. Showing a wrong diff and then editing someone's build config on the strength of
 * it is worse than not offering the command.
 *
 * Myers' algorithm, which costs time in the size of the *change* rather than of the file:
 * the full longest-common-subsequence table it replaced was (lines + 1)² numbers, took
 * 6.7 s on a 10,000-line config and ran out of memory at 30,000 — with `--json` printing
 * nothing at all. An edit this command writes changes three lines.
 */
export function diffOf(edit: Edit): string {
  const before = edit.before.split("\n");
  const after = edit.after.split("\n");
  // The unchanged ends need no search, and trimming them makes the rest small.
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head += 1;
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1;
  }
  const a = before.slice(head, before.length - tail);
  const b = after.slice(head, after.length - tail);
  return shortestEdit(a, b)
    .map(([op, line]) => `${op} ${line}`)
    .join("\n");
}

/** The fewest `-`/`+` lines that turn `a` into `b`, in order. */
function shortestEdit(a: string[], b: string[]): [op: "-" | "+", line: string][] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  // Past this many changes the search's memory grows as its square; a diff that large is
  // not one of this command's edits, and listing both sides whole is still correct.
  const limit = 2000;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= Math.min(max, limit) && found === -1; d += 1) {
    trace.push(v.slice(max - d, max + d + 1));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[max + k - 1] as number) < (v[max + k + 1] as number));
      let x = down ? (v[max + k + 1] as number) : (v[max + k - 1] as number) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[max + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found === -1) {
    return [
      ...a.map((line): ["-", string] => ["-", line]),
      ...b.map((line): ["+", string] => ["+", line]),
    ];
  }

  const edits: [op: "-" | "+", line: string][] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d -= 1) {
    const window = trace[d] as Int32Array;
    const at = (k: number) => window[k + d] as number;
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const previous = down ? k + 1 : k - 1;
    x = at(previous);
    y = x - previous;
    edits.push(down ? ["+", b[y] as string] : ["-", a[x] as string]);
  }
  return edits.reverse();
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
  const where = (file: string) => (relative(cwd, file) || file).split(sep).join("/");
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

  const reading = await readWiring(host);
  const { state } = reading;
  const tailwind = tailwindNote(host, reading, where);
  if (tailwind) say(tailwind, true);
  const extra = tailwind ? { tailwind: false } : {};

  if (state === "wired") {
    const via = reading.via ? ` through ${where(reading.via)}` : "";
    say(`[tailess] ${where(host.file)} calls the plugin${via}. Nothing to do.`);
    return done(0, {
      host: host.kind,
      file: where(host.file),
      wired: true,
      ...(reading.via ? { via: where(reading.via) } : {}),
      ...extra,
    });
  }

  if (state === "unknown") {
    // A plugin list built in a shared preset is the shape every monorepo has, and failing
    // it failed a working build — `check` abstains on the same shape. This says what it
    // could not read, rather than guessing either way.
    say(
      `[tailess] ${where(host.file)} does not call the plugin itself, and imports ` +
        `${reading.unread}, which doctor could not read. If that adds it, nothing is wrong; ` +
        "if it does not, no variant class on the page has CSS behind it:",
      true,
    );
    say(`\n${handEdit(host)}`, true);
    return done(0, {
      host: host.kind,
      file: where(host.file),
      wired: null,
      unread: reading.unread,
      ...extra,
    });
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
    ...extra,
  });
}

/** What {@link readWiring} found, and — when it followed an import — where. */
export interface Reading {
  state: Wiring | "unknown";
  /** The local module the plugin was found in, when not the config itself. */
  via?: string;
  /** The first local import that could not be read, when that left it undecided. */
  unread?: string;
  /** Every source read, for questions about the whole config. */
  sources: string[];
}

/** A relative module a config imports, re-exports or requires. */
const localModule =
  /^[ \t]*(?:import|export)\b[^;"'`]*?\bfrom\s*["'](\.\.?\/[^"'\n]*)["']|^[ \t]*import\s*["'](\.\.?\/[^"'\n]*)["']|\brequire\s*\(\s*["'](\.\.?\/[^"'\n]*)["']/gm;

/**
 * A module that is not code. Listed rather than inferred: `./vite.shared` and
 * `./vite.base` are code with a dot in the name, and reading `.shared` as an extension
 * skipped exactly the preset this follows imports to find.
 */
const nonCode =
  /\.(?:json5?|css|s[ac]ss|less|styl|svg|png|jpe?g|gif|webp|avif|ico|wasm|txt|md|html|ya?ml|toml|node)$/i;

/** The file a relative specifier names, trying what a config's loader would. */
async function resolveLocal(from: string, specifier: string): Promise<string | undefined> {
  const base = join(dirname(from), specifier);
  // TypeScript's ESM spelling names `./shared.js` for `./shared.ts`.
  const stem = base.replace(/\.[cm]?js$/, "");
  const extensions = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".tsx", ".jsx"];
  const candidates = [
    base,
    ...extensions.map((ext) => stem + ext),
    ...extensions.map((ext) => join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if ((await stat(candidate).catch(() => undefined))?.isFile()) return candidate;
  }
  return undefined;
}

/**
 * How `host` wires the plugin, following its local imports a few levels deep.
 *
 * Reading one file answered "not wired" for a plugin list built in `./vite.shared.ts` —
 * a working build, failed, and `init` then registered the plugin a second time. A local
 * module that does not wire it either leaves the answer "unwired"; one that cannot be
 * found or read leaves it "unknown", which `doctor` says rather than guessing at.
 */
export async function readWiring(host: Exclude<Host, { kind: "unknown" }>): Promise<Reading> {
  const kind = pluginFor(basename(host.file), host.source);
  const seen = new Set<string>();
  const read = async (file: string, source: string, depth: number): Promise<Reading> => {
    seen.add(file);
    const state = wiring(source, kind);
    const sources = [source];
    if (state !== "unwired" || ("data" in host && host.data)) return { state, sources };
    let unread: string | undefined;
    for (const match of maskLiterals(source).matchAll(localModule)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? "";
      // `./package.json`, a stylesheet or an asset carries no plugin list.
      if (nonCode.test(specifier)) continue;
      const path = await resolveLocal(file, specifier);
      if (path && seen.has(path)) continue;
      const text = path ? await readFile(path, "utf8").catch(() => undefined) : undefined;
      if (path === undefined || text === undefined || depth === 0) {
        unread ??= specifier;
        continue;
      }
      const inner = await read(path, text, depth - 1);
      sources.push(...inner.sources);
      if (inner.state === "wired" || inner.state === "misordered") {
        return { state: inner.state, via: inner.via ?? path, sources };
      }
      if (inner.state === "unknown") unread ??= specifier;
    }
    return unread ? { state: "unknown", unread, sources } : { state: "unwired", sources };
  };
  return read(host.file, host.source, 3);
}

/**
 * A note when the config never loads Tailwind's own plugin, or `undefined`.
 *
 * Wiring tailess into a config that compiles no Tailwind leaves nothing styled at all,
 * and `doctor` called that healthy. It is a note rather than a failure: a plugin preset
 * from a package can bring Tailwind in where no file here can see it, and failing a
 * working build on a guess is the one thing this command must not do.
 */
function tailwindNote(
  host: Exclude<Host, { kind: "unknown" }>,
  reading: Reading,
  where: (file: string) => string,
): string | undefined {
  if (reading.state === "unknown") return undefined;
  const wanted =
    pluginFor(basename(host.file), host.source) === "vite"
      ? "@tailwindcss/vite"
      : host.kind === "postcss"
        ? "@tailwindcss/postcss"
        : undefined;
  if (!wanted) return undefined;
  if (reading.sources.some((source) => mentions(source, wanted))) return undefined;
  return (
    `[tailess] note: ${where(host.file)} does not load ${wanted} either, so unless another ` +
    "plugin brings it in, nothing compiles Tailwind and no class has CSS. Add it too."
  );
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
    const plugins = host.framework
      ? "vite: { plugins: [tailwindcss(), tailess()] }"
      : "plugins: [tailwindcss(), tailess()]";
    return cjs
      ? `  const tailess = require("tailess/vite");\n  ${plugins}`
      : `  import tailess from "tailess/vite";\n  ${plugins}`;
  }
  const order = "\n\ntailess must come first: it writes the candidate list Tailwind then reads.";
  // A JSON config needs its keys quoted, and a YAML one is not braces at all.
  if (host.data === "yaml") {
    return `  plugins:\n    tailess/postcss: {}\n    "@tailwindcss/postcss": {}${order}`;
  }
  if (host.data === "json") {
    return `  "plugins": { "tailess/postcss": {}, "@tailwindcss/postcss": {} }${order}`;
  }
  if (host.data === "package.json") {
    return `  "postcss": { "plugins": { "tailess/postcss": {}, "@tailwindcss/postcss": {} } }${order}`;
  }
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
  const where = (file: string) => (relative(cwd, file) || file).split(sep).join("/");
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

  const reading = await readWiring(host);
  const { state } = reading;
  if (state === "wired") {
    const via = reading.via ? ` through ${where(reading.via)}` : "";
    say(`[tailess] ${where(host.file)} already calls the plugin${via}. Nothing to do.`);
    return done(0, { file: where(host.file), wired: true, written: false });
  }
  if (state === "unknown") {
    say(
      `[tailess] ${where(host.file)} imports ${reading.unread}, which init could not read, ` +
        "so it cannot tell whether the plugin is already there. Nothing was written. " +
        "`npx tailess doctor` prints the line to add by hand.",
      true,
    );
    return done(2, { error: "not-editable", file: where(host.file), unread: reading.unread });
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
    const what =
      host.kind === "vite" && host.framework
        ? `is ${host.framework}'s own config, which init reads but does not edit`
        : host.kind === "postcss" && host.data
          ? "is data rather than code, which init reads but does not edit"
          : "has no plugins list this can edit safely";
    say(
      `[tailess] ${where(host.file)} ${what}, so nothing was written. ` +
        "`npx tailess doctor` prints the line to add.",
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

  const diff = diffOf(plan);
  say(`[tailess] ${where(plan.file)}\n\n${diff}\n`);
  if (!write) {
    say("[tailess] nothing written. Re-run with --write to apply it.");
    return done(0, { file: where(plan.file), written: false, diff });
  }

  await writeFile(plan.file, plan.after, "utf8");
  say(`[tailess] wrote ${where(plan.file)}. Restart your dev server.`);
  const tailwind = tailwindNote(host, reading, where);
  if (tailwind) say(tailwind, true);
  return done(0, {
    file: where(plan.file),
    written: true,
    diff,
    ...(tailwind ? { tailwind: false } : {}),
  });
}
